#!/usr/bin/env python3
"""
Script para convertir un documento Markdown a PDF.
Usa markdown2 para parsear y weasyprint para generar el PDF.

Instalación de dependencias:
    pip install markdown2 weasyprint

En Ubuntu/Debian también necesitas:
    sudo apt install libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0
"""

import sys
from pathlib import Path

try:
    import markdown2
    from weasyprint import HTML, CSS
except ImportError:
    print("Error: Faltan dependencias. Ejecuta:")
    print("  pip install markdown2 weasyprint")
    sys.exit(1)


# CSS para el PDF
CSS_STYLES = """
@page {
    size: A4;
    margin: 2cm;
    @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font-size: 10px;
        color: #666;
    }
}

body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
}

h1 {
    font-size: 24pt;
    color: #1a1a1a;
    padding-bottom: 10px;
    margin-top: 0;
}

h2 {
    font-size: 16pt;
    color: #1e40af;
    border-bottom: 1px solid #ddd;
    padding-bottom: 5px;
    margin-top: 30px;
    page-break-after: avoid;
}

h3 {
    font-size: 13pt;
    color: #1e3a5f;
    margin-top: 20px;
    page-break-after: avoid;
}

h4 {
    font-size: 11pt;
    color: #374151;
    margin-top: 15px;
    page-break-after: avoid;
}

p {
    margin: 10px 0;
    text-align: justify;
}

/* Tablas */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
    font-size: 10pt;
    page-break-inside: avoid;
}

thead {
    display: table-header-group;
}

tr {
    page-break-inside: avoid;
    page-break-after: auto;
}

th {
    background-color: #1e40af;
    color: white;
    font-weight: bold;
    padding: 10px 8px;
    text-align: left;
    border: 1px solid #1e3a8a;
}

td {
    padding: 8px;
    border: 1px solid #ddd;
    vertical-align: top;
}

tr:nth-child(even) {
    background-color: #f8fafc;
}

/* Listas */
ul, ol {
    margin: 10px 0;
    padding-left: 25px;
}

li {
    margin: 5px 0;
}

/* Código y preformateado - MEJORADO para diagramas ASCII */
code {
    background-color: #f3f4f6;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
    font-size: 10pt;
}

pre {
    background-color: #f8f9fa;
    color: #333;
    padding: 15px;
    border-radius: 5px;
    border: 1px solid #e5e7eb;
    overflow-x: auto;
    font-size: 8pt;
    line-height: 1.2;
    page-break-inside: avoid;
    white-space: pre;
    font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
}

pre code {
    background-color: transparent;
    padding: 0;
    color: inherit;
    font-size: 8pt;
    white-space: pre;
}

/* Separadores */
hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 30px 0;
}

/* Negritas y énfasis */
strong {
    color: #1f2937;
}

em {
    font-style: italic;
}

/* Links */
a {
    color: #2563eb;
    text-decoration: none;
}

/* Encabezado del documento */
body > p:first-of-type {
    background-color: #f8fafc;
    padding: 15px;
    margin-bottom: 20px;
}

/* Evitar cortes de página en secciones importantes */
h2 + *, h3 + *, h4 + * {
    page-break-before: avoid;
}

/* Secciones que no deben cortarse */
.no-break {
    page-break-inside: avoid;
}

/* Pie de página del documento */
body > p:last-of-type {
    font-style: italic;
    color: #666;
    text-align: center;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #ddd;
}

/* Criterios de aceptación - lista con checkboxes */
ul li {
    page-break-inside: avoid;
}
"""


def convert_md_to_pdf(input_path: str, output_path: str = None) -> str:
    """
    Convierte un archivo Markdown a PDF.

    Args:
        input_path: Ruta al archivo .md
        output_path: Ruta de salida para el PDF (opcional)

    Returns:
        Ruta del archivo PDF generado
    """
    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {input_path}")

    if output_path is None:
        output_path = input_file.with_suffix('.pdf')

    output_file = Path(output_path)

    # Leer el contenido Markdown
    print(f"Leyendo: {input_file}")
    md_content = input_file.read_text(encoding='utf-8')

    # Convertir Markdown a HTML
    print("Convirtiendo Markdown a HTML...")
    html_content = markdown2.markdown(
        md_content,
        extras=[
            'tables',
            'fenced-code-blocks',
            'header-ids',
            'task_list',
            'cuddled-lists',
            'break-on-newline'
        ]
    )

    # Crear documento HTML completo
    full_html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Escalera Life — Propuesta</title>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """

    # Generar PDF
    print(f"Generando PDF: {output_file}")
    HTML(string=full_html).write_pdf(
        output_file,
        stylesheets=[CSS(string=CSS_STYLES)]
    )

    print(f"PDF generado exitosamente: {output_file}")
    return str(output_file)


def main():
    # Rutas por defecto
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    docs_dir = project_dir / "docs"

    # Archivo de entrada por defecto
    default_input = docs_dir / "la-escalera-propuesta.md"

    # Permitir especificar archivo por argumento
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
    else:
        input_path = str(default_input)

    # Permitir especificar salida por argumento
    if len(sys.argv) > 2:
        output_path = sys.argv[2]
    else:
        output_path = None

    try:
        result = convert_md_to_pdf(input_path, output_path)
        print(f"\n✓ Conversión completada: {result}")
    except FileNotFoundError as e:
        print(f"\n✗ Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error durante la conversión: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
