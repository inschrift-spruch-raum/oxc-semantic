use std::{mem, sync::Arc};

use napi::{bindgen_prelude::AsyncTask, Task};
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast_visit::utf8_to_utf16::Utf8ToUtf16;
use oxc_diagnostics::{NamedSource, OxcDiagnostic, Severity};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::{SourceType, Span};
use oxc_syntax::{reference::ReferenceFlags, scope::ScopeFlags, symbol::SymbolFlags};

#[napi(object)]
#[derive(Default)]
pub struct AnalyzeOptions {
    #[napi(ts_type = "'js' | 'jsx' | 'ts' | 'tsx' | 'dts'")]
    pub lang: Option<String>,
    #[napi(ts_type = "'script' | 'module' | 'commonjs' | 'unambiguous'")]
    pub source_type: Option<String>,
    pub include_unresolved: Option<bool>,
}

#[napi(object)]
pub struct Range {
    pub start: u32,
    pub end: u32,
}

#[napi(object)]
pub struct DiagnosticLabel {
    pub message: Option<String>,
    pub start: u32,
    pub end: u32,
}

#[napi(string_enum)]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Advice,
}

#[napi(object)]
pub struct Diagnostic {
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub labels: Vec<DiagnosticLabel>,
    pub help_message: Option<String>,
    pub codeframe: Option<String>,
}

#[napi(object)]
pub struct Scope {
    pub id: u32,
    pub parent_id: Option<u32>,
    pub node_id: u32,
    pub flags: Vec<String>,
    pub symbol_ids: Vec<u32>,
}

#[napi(object)]
pub struct Symbol {
    pub id: u32,
    pub name: String,
    pub range: Range,
    pub scope_id: u32,
    pub declaration_node_id: u32,
    pub flags: Vec<String>,
    pub reference_ids: Vec<u32>,
    pub is_mutated: bool,
    pub is_unused: bool,
}

#[napi(object)]
pub struct Reference {
    pub id: u32,
    pub name: String,
    pub range: Range,
    pub node_id: u32,
    pub scope_id: u32,
    pub symbol_id: Option<u32>,
    pub flags: Vec<String>,
    pub is_unresolved: bool,
}

#[napi(object)]
pub struct AnalyzeResult {
    pub source_type: String,
    pub scopes: Vec<Scope>,
    pub symbols: Vec<Symbol>,
    pub references: Vec<Reference>,
    pub diagnostics: Vec<Diagnostic>,
}

fn source_type(filename: &str, options: &AnalyzeOptions) -> SourceType {
    let inferred = SourceType::from_path(filename.replace('\\', "/")).ok();
    let ty = match options.lang.as_deref() {
        Some("js") => inferred
            .unwrap_or_else(SourceType::unambiguous)
            .with_javascript(true)
            .with_standard(true),
        Some("jsx") => inferred
            .unwrap_or_else(|| SourceType::jsx().with_unambiguous(true))
            .with_javascript(true)
            .with_jsx(true),
        Some("ts") => inferred
            .unwrap_or_else(SourceType::ts)
            .with_typescript(true)
            .with_standard(true),
        Some("tsx") => inferred
            .unwrap_or_else(SourceType::tsx)
            .with_typescript(true)
            .with_jsx(true),
        Some("dts") => inferred
            .unwrap_or_else(SourceType::d_ts)
            .with_typescript_definition(true)
            .with_standard(true),
        _ => inferred.unwrap_or_default(),
    };
    match options.source_type.as_deref() {
        Some("script") => ty.with_script(true),
        Some("module") => ty.with_module(true),
        Some("commonjs") => ty.with_commonjs(true),
        Some("unambiguous") => ty.with_unambiguous(true),
        _ => ty,
    }
}

fn range(span: Span) -> Range {
    Range {
        start: span.start,
        end: span.end,
    }
}

fn utf16_range(source: &Utf8ToUtf16, value: Span) -> Range {
    let mut span = value;
    if let Some(mut converter) = source.converter() {
        converter.convert_span(&mut span);
    }
    range(span)
}

fn flags<T: std::fmt::Debug>(value: T) -> Vec<String> {
    let debug = format!("{value:?}");
    let contents = debug
        .split_once('(')
        .and_then(|(_, contents)| contents.strip_suffix(')'))
        .unwrap_or(&debug);
    contents
        .trim_matches('{')
        .trim_matches('}')
        .split(" | ")
        .filter(|part| !part.is_empty())
        .map(str::to_owned)
        .collect()
}

fn flag_names<T: std::fmt::Debug>(value: T, is_empty: impl FnOnce(&T) -> bool) -> Vec<String> {
    if is_empty(&value) {
        Vec::new()
    } else {
        flags(value)
    }
}

fn diagnostic(
    value: OxcDiagnostic,
    source: &Utf8ToUtf16,
    named_source: &Arc<NamedSource<String>>,
) -> Diagnostic {
    let codeframe = value
        .clone()
        .render_with_source_code(Arc::clone(named_source));
    let inner = value.inner_owned();
    let labels = inner
        .labels
        .iter()
        .map(|label| {
            let range = utf16_range(source, label.span());
            DiagnosticLabel {
                message: label.label().map(str::to_owned),
                start: range.start,
                end: range.end,
            }
        })
        .collect();
    Diagnostic {
        severity: match inner.severity {
            Severity::Error => DiagnosticSeverity::Error,
            Severity::Warning => DiagnosticSeverity::Warning,
            Severity::Advice => DiagnosticSeverity::Advice,
        },
        message: inner.message.into_owned(),
        labels,
        help_message: inner.help.map(Into::into),
        codeframe: Some(codeframe),
    }
}

fn collect_diagnostics(
    values: impl IntoIterator<Item = OxcDiagnostic>,
    source: &Utf8ToUtf16,
    filename: &str,
    source_text: &str,
) -> Vec<Diagnostic> {
    let mut values = values.into_iter().peekable();
    if values.peek().is_none() {
        return Vec::new();
    }
    let named_source = Arc::new(NamedSource::new(filename, source_text.to_owned()));
    values
        .map(|value| diagnostic(value, source, &named_source))
        .collect()
}

fn analyze_impl(filename: &str, source_text: &str, options: AnalyzeOptions) -> AnalyzeResult {
    let allocator = Allocator::default();
    let source_type = source_type(filename, &options);
    let source = Utf8ToUtf16::new(source_text);
    let parser = Parser::new(&allocator, source_text, source_type).parse();
    let mut diagnostics = collect_diagnostics(parser.diagnostics, &source, filename, source_text);
    if !diagnostics.is_empty() {
        return AnalyzeResult {
            source_type: source_type_name(parser.program.source_type),
            scopes: Vec::new(),
            symbols: Vec::new(),
            references: Vec::new(),
            diagnostics,
        };
    }

    let semantic_return = SemanticBuilder::new_compiler()
        .with_build_nodes(true)
        .build(&parser.program);
    diagnostics.extend(collect_diagnostics(
        semantic_return.diagnostics,
        &source,
        filename,
        source_text,
    ));
    let semantic = semantic_return.semantic;
    let scoping = semantic.scoping();
    let scopes = scoping
        .scope_descendants_from_root()
        .map(|id| Scope {
            id: id.index() as u32,
            parent_id: scoping
                .scope_parent_id(id)
                .map(|parent| parent.index() as u32),
            node_id: scoping.get_node_id(id).index() as u32,
            flags: flag_names(scoping.scope_flags(id), ScopeFlags::is_empty),
            symbol_ids: scoping
                .iter_bindings_in(id)
                .map(|symbol| symbol.index() as u32)
                .collect(),
        })
        .collect::<Vec<_>>();
    let symbols = scoping
        .symbol_ids()
        .map(|id| {
            let declaration = scoping.symbol_declaration(id);
            Symbol {
                id: id.index() as u32,
                name: scoping.symbol_name(id).to_owned(),
                range: utf16_range(&source, scoping.symbol_span(id)),
                scope_id: scoping.symbol_scope_id(id).index() as u32,
                declaration_node_id: declaration.index() as u32,
                flags: flag_names(scoping.symbol_flags(id), SymbolFlags::is_empty),
                reference_ids: scoping
                    .get_resolved_reference_ids(id)
                    .iter()
                    .map(|reference| reference.index() as u32)
                    .collect(),
                is_mutated: scoping.symbol_is_mutated(id),
                is_unused: scoping.symbol_is_unused(id),
            }
        })
        .collect::<Vec<_>>();
    let include_unresolved = options.include_unresolved.unwrap_or(true);
    let references = (0..scoping.references_len())
        .map(oxc_syntax::reference::ReferenceId::from_usize)
        .filter_map(|id| {
            let reference = scoping.get_reference(id);
            if !include_unresolved && reference.symbol_id().is_none() {
                return None;
            }
            let node_id = reference.node_id();
            Some(Reference {
                id: id.index() as u32,
                name: semantic.reference_name(reference).to_owned(),
                range: utf16_range(&source, semantic.reference_span(reference)),
                node_id: node_id.index() as u32,
                scope_id: reference.scope_id().index() as u32,
                symbol_id: reference.symbol_id().map(|symbol| symbol.index() as u32),
                flags: flag_names(reference.flags(), ReferenceFlags::is_empty),
                is_unresolved: reference.symbol_id().is_none(),
            })
        })
        .collect();
    AnalyzeResult {
        source_type: source_type_name(parser.program.source_type),
        scopes,
        symbols,
        references,
        diagnostics,
    }
}

fn source_type_name(value: SourceType) -> String {
    if value.is_typescript_definition() {
        return "dts".to_owned();
    }
    let language = if value.is_typescript() { "ts" } else { "js" };
    let language = if value.is_jsx() {
        format!("{language}x")
    } else {
        language.to_owned()
    };
    let module = if value.is_script() {
        "script"
    } else if value.is_commonjs() {
        "commonjs"
    } else {
        "module"
    };
    format!("{language}/{module}")
}

#[napi]
pub fn analyze_sync(
    filename: String,
    source_text: String,
    options: Option<AnalyzeOptions>,
) -> AnalyzeResult {
    analyze_impl(&filename, &source_text, options.unwrap_or_default())
}

pub struct AnalyzeTask {
    filename: String,
    source_text: String,
    options: AnalyzeOptions,
}

#[napi]
impl Task for AnalyzeTask {
    type JsValue = AnalyzeResult;
    type Output = AnalyzeResult;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        let source_text = mem::take(&mut self.source_text);
        Ok(analyze_impl(
            &self.filename,
            &source_text,
            mem::take(&mut self.options),
        ))
    }

    fn resolve(&mut self, _: napi::Env, result: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(result)
    }
}

#[napi]
pub fn analyze(
    filename: String,
    source_text: String,
    options: Option<AnalyzeOptions>,
) -> AsyncTask<AnalyzeTask> {
    AsyncTask::new(AnalyzeTask {
        filename,
        source_text,
        options: options.unwrap_or_default(),
    })
}

#[napi]
pub fn binding_target() -> String {
    "wasm32-wasi".to_owned()
}

#[napi]
pub fn native_platform() -> String {
    "wasm32-wasi".to_owned()
}
