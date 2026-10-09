---
name: email-templates
description: Rules for writing HTML that renders correctly in email clients (Outlook, Gmail, Apple Mail) — table layout, inline styles, Outlook quirks, images, buttons. Use when writing or editing html.hbs or layout.hbs of the send-email Edge Function, or fixing how a mail renders.
---

# Email HTML

Email HTML is not web HTML. Outlook for Windows renders with Word's engine,
Gmail strips and clips, and none of them run a modern browser, so the layout
and CSS habits of the app do not apply. This skill covers only that.

How templates are registered, resolved and escaped is in
[docs/coding-standards.md](../../../docs/coding-standards.md) ("Email
templates"). Read `supabase/functions/send-email/templates/layout.hbs` and
`test-message/html.hbs` first; they are the working example.

## Writing `html.hbs` (the fragment)

The fragment is inserted into one `<td>` of `layout.hbs` as `{{{body}}}`, so it
carries **no** `<html>`, `<head>`, `<body>` or outer wrapper table. Use
`{{value}}` for anything a customer typed; `{{{triple}}}` only for markup the
code itself produced.

- **Inline styles on every element.** Fragment-level `<style>` blocks do not
  work (they would land inside `<body>`) and are forbidden by the repo
  standard. A media query or dark-mode rule, if ever needed, goes in the
  layout's `<head>`, targeting classes the fragment sets — and the fragment
  must still look right without it.
- **Tables for anything beyond text flow.** Paragraphs, headings and simple
  lists can be `<p>` / `<h*>` with an explicit `margin` (clients add their own
  default margins otherwise; the test-message uses `margin: 0 0 16px`). Any
  multi-column or aligned layout (key/value rows, line-item lists, buttons) is
  a `<table role="presentation">` — no flexbox, grid, float or `position`.
- **Spacing:** use `padding` on `<td>`; `margin` on `<td>` / `<table>` is
  unreliable in Outlook. For vertical gaps between table rows use a spacer
  `<tr><td height="24" style="font-size: 24px; line-height: 24px;">&nbsp;</td></tr>`.
- **Units and fonts:** `px` only (no `em`, `rem`, `%` for font sizes, no `calc()`,
  no CSS variables). Font stack `Arial, Helvetica, sans-serif` to match the
  layout; no web fonts.
- **Shorthands:** `padding`, `margin`, `border` shorthands are fine (the layout
  uses them). Write `font` and `background` out longhand — those are the
  ones clients mishandle.
- **Colours:** hex values written out; no `rgba()` for anything that must be
  readable in Outlook. Pair any `background-image` with a `background-color`.
- **Widths:** give tables/cells `width` as an attribute and in `style`
  where the width matters; `max-width` is ignored by Outlook, so pair it with
  a `width`.
- **Images:** absolute `https` URLs only (never relative, never base64), with
  `alt`, `width`, `height`, `border="0"` and `style="display: block;"`. The
  mail must still read correctly with images blocked.
- **Links and buttons:** a button is a link inside a table cell with
  `background-color` and padding on the `<a>` (`display: inline-block`). For
  rounded buttons that must look rounded in Outlook, use the VML pattern below;
  otherwise accept square buttons in Outlook.
- **Size:** keep the final HTML under 102 KB (Gmail clips beyond that); loops
  over many rows are what get a mail there.
- **Conditionals and loops:** `{{#if}}` / `{{#each}}` must not break table
  structure — a loop emits whole `<tr>`s, a conditional wraps whole rows or
  whole inline runs, never half a tag. Do not reformat or move existing
  Handlebars expressions when restyling around them.

### Loop example

```hbs
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  {{#each lines}}
  <tr>
    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">{{name}}</td>
    <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">{{quantity}}</td>
  </tr>
  {{/each}}
</table>
```

### Rounded button with Outlook fallback

Only when the design needs it. Declare `xmlns:v` and `xmlns:w` on the
`<html>` element of `layout.hbs` once (the Office namespaces are required for
`v:` and `w:` tags), then:

```html
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
  href="{{url}}" style="height:44px; v-text-anchor:middle; width:200px;"
  arcsize="10%" strokecolor="#111827" fillcolor="#111827">
  <w:anchorlock/>
  <center style="color:#ffffff; font-family:Arial,sans-serif; font-size:16px; font-weight:bold;">{{label}}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a href="{{url}}" style="background-color: #111827; border-radius: 4px; color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; line-height: 44px; text-align: center; text-decoration: none; width: 200px;">{{label}}</a>
<!--<![endif]-->
```

## Editing `layout.hbs`

It affects every mail. Keep it HTML5 (`<!DOCTYPE html>`), a centred 600px
table with `width: 100%; max-width: 600px`, and `{{{body}}}` and `{{subject}}`
as the only inputs. If you add Outlook DPI handling, put this in `<head>`:

```html
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
```

(with `xmlns:o="urn:schemas-microsoft-com:office:office"` on `<html>`). After a
layout change, re-render at least `test-message` and compare.

## Client support, verified rather than remembered

Support changes. Before relying on a CSS property or HTML feature that is not
already used in `layout.hbs`, check it on <https://www.caniemail.com/>. Things
that are stable enough to rely on: Outlook for Windows renders with Word (no
`border-radius`, `max-width`, `background-image`, `margin` on cells, flex or
grid); Gmail clips above ~102 KB; Gmail on Android with non-Google accounts
(GANGA) drops `<style>` blocks, so inline is the source of truth.
`prefers-color-scheme` support is partial (not in the Gmail apps) — never rely
on it for legibility; use colours that read on both light and dark
backgrounds.

## Checklist before handing back

1. `html.hbs` is a fragment with inline styles, table layout where needed,
   no `<style>`.
2. Every `{{{triple}}}` is justified; customer-entered values use `{{double}}`.
3. Images (if any) have absolute URLs, `alt` and dimensions.
4. The mail still reads correctly with images blocked.
5. The function boots locally and the mail renders (smoke path / e2e).
