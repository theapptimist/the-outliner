# Link Document Hanging Indent Logic

When linking a document to an outline node, the system preserves the original node type to maintain numbering behavior:

## Key Behaviors

1. **BODY nodes stay BODY**: When a hanging indent (type: 'body') node is converted to a link, the type stays 'body' with `linkedDocumentId` and `linkedDocumentTitle` added. This keeps it unnumbered.

2. **Regular nodes become LINK**: When a normal node is converted to a link, it gets `type: 'link'`.

3. **isLinkLike rendering**: The renderer uses `isLinkLike = node.type === 'link' || !!node.linkedDocumentId` to determine if a node should render as a link (with icon, underline, special keyboard handling), regardless of whether `type` is 'link' or 'body'.

4. **Numbering remains based on type**: Prefix/numbering suppression is still based on `node.type === 'body'`, so body-links stay unnumbered.

## Workflow
- Header with colon → Shift+Enter creates BODY child (hanging indent)
- Link that BODY → remains unnumbered, renders as link
