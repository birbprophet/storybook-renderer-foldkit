const escapeHtml = (str: string): string =>
  str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");

const VOID_ELEMENTS: Readonly<Record<string, true>> = {
  area: true,
  base: true,
  br: true,
  col: true,
  embed: true,
  hr: true,
  img: true,
  input: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true,
};

type VNodeData = Readonly<{
  attrs?: Record<string, unknown>;
  class?: Record<string, boolean | undefined>;
  props?: Record<string, unknown>;
  style?: Record<string, string | undefined>;
}>;

type VNodeLike = Readonly<{
  children?: ReadonlyArray<unknown>;
  data?: VNodeData;
  sel?: string;
  text?: string;
}>;

export const toHtml = (node: unknown): string => {
  if (node == null) return "";
  if (typeof node === "string") return escapeHtml(node);
  if (typeof node !== "object") return escapeHtml(String(node));

  const vnode = node as VNodeLike;
  if (vnode.text != null) return escapeHtml(vnode.text);
  if (!vnode.sel) return "";

  const tag = vnode.sel;
  const attrs: string[] = [];

  if (vnode.data?.class) {
    const classNames = Object.entries(vnode.data.class)
      .filter(([_, active]) => Boolean(active))
      .map(([cls]) => cls);
    if (classNames.length > 0) {
      attrs.push(`class="${escapeHtml(classNames.join(" "))}"`);
    }
  }

  if (vnode.data?.style) {
    const styles = Object.entries(vnode.data.style)
      .filter(([_, value]) => value != null && value !== "")
      .map(([prop, value]) => {
        const kebabProp = prop.replaceAll(/[A-Z]/gu, (m) => `-${m.toLowerCase()}`);
        return `${kebabProp}:${String(value)}`;
      });
    if (styles.length > 0) {
      attrs.push(`style="${escapeHtml(styles.join(";"))}"`);
    }
  }

  if (vnode.data?.attrs) {
    for (const [key, value] of Object.entries(vnode.data.attrs)) {
      if (value === true) {
        attrs.push(key);
      } else if (value !== false && value != null) {
        attrs.push(`${key}="${escapeHtml(String(value))}"`);
      }
    }
  }

  if (vnode.data?.props) {
    for (const [key, value] of Object.entries(vnode.data.props)) {
      if (key === "value" && value != null) {
        attrs.push(`value="${escapeHtml(String(value))}"`);
      } else if (key === "checked" && Boolean(value)) {
        attrs.push("checked");
      } else if (key === "disabled" && Boolean(value)) {
        attrs.push("disabled");
      }
    }
  }

  const attrsStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";

  if (VOID_ELEMENTS[tag] === true) {
    return `<${tag}${attrsStr} />`;
  }

  const childrenHtml = (vnode.children ?? []).map(toHtml).join("");
  return `<${tag}${attrsStr}>${childrenHtml}</${tag}>`;
};
