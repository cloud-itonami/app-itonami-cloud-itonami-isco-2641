// Pure view model: repository data becomes a plain tree of nodes, and only
// app.js turns those nodes into DOM elements. Nothing here touches the DOM,
// so node tests can call every function in this file directly.
//
// A node is { tag, attrs, children } for elements or { text } for text:
// tag is an HTML tag name, attrs a plain object of attribute names to
// strings, children an array of nodes. Text always travels as text nodes,
// never as markup.
export const TAB_OVERVIEW = "overview";
export const TAB_CONSOLE = "console";
export const TAB_PHYSICS = "physics";
export const TAB_MANUSCRIPT = "manuscript";
export const TAB_ABOUT = "about";

/** The tabs for one built data object, in display order. */
export function tabsFor(data) {
  const tabs = [{ id: TAB_OVERVIEW, label: "概要" }];
  if (data && data.console) tabs.push({ id: TAB_CONSOLE, label: "操作卓の見本" });
  if (data && data.physics) tabs.push({ id: TAB_PHYSICS, label: "物理仕様" });
  // The manuscript tab is always present: with no manuscript bundled, it
  // reports that honestly instead of hiding the screen.
  tabs.push({ id: TAB_MANUSCRIPT, label: "原稿" });
  tabs.push({ id: TAB_ABOUT, label: "この app について" });
  return tabs;
}

/** The panel tree for one tab id. Unknown ids fall back to the overview. */
export function panelTree(data, tabId) {
  if (tabId === TAB_CONSOLE && data.console) return consoleTree(data.console);
  if (tabId === TAB_PHYSICS && data.physics) return physicsTree(data);
  if (tabId === TAB_MANUSCRIPT) return manuscriptTree(data);
  if (tabId === TAB_ABOUT) return aboutTree(data);
  return overviewTree(data);
}

/** A panel tree shown instead of every tab when the descriptor is broken. */
export function errorTree(problems) {
  return node("div", {}, [
    node("h2", {}, [text("表示できません")]),
    node("p", { class: "problem" }, [text("記述子 (descriptor) に問題があるため、この app は内容を表示しません。")]),
    node("ul", {}, problems.map((p) => node("li", {}, [text(`${p.field}: ${p.error}`)]))),
  ]);
}

function overviewTree(data) {
  const identity = data.identity;
  const entries = Object.entries(data.blueprint).map(([key, value]) =>
    [keyNode(key), node("dd", {}, [valueNode(value)])],
  ).flat();
  return node("div", {}, [
    node("h2", {}, [text("概要")]),
    node("p", {}, [text(identity.classification)]),
    node("p", { class: "muted" }, [text(identity.source)]),
    node("dl", {}, entries),
  ]);
}

function consoleTree(console) {
  const parts = [
    node("h2", {}, [text("操作卓の見本")]),
    node("p", { class: "sample-note" }, [text("この表示は docs/samples/operator-console.html の見本です。実データ（ライブ）ではありません。")]),
  ];
  if (console.title) parts.push(node("h3", {}, [text(console.title)]));
  if (console.badge) parts.push(node("p", { class: "badge" }, [text(console.badge)]));
  for (const section of console.sections) {
    const blocks = [node("h3", {}, [text(section.heading)])];
    for (const note of section.notes) blocks.push(node("p", {}, [text(note)]));
    for (const table of section.tables) blocks.push(tableNode(table));
    parts.push(node("section", {}, blocks));
  }
  return node("div", {}, parts);
}

function tableNode(table) {
  const head = table.columns.length
    ? [node("thead", {}, [node("tr", {}, table.columns.map((c) => node("th", { scope: "col" }, [text(c)])))])]
    : [];
  const body = table.rows.map((row) =>
    node("tr", {}, row.map((cell) =>
      cell.tone
        ? node("td", {}, [node("span", { class: `tone-${cell.tone}` }, [text(cell.text)])])
        : node("td", {}, [text(cell.text)]),
    )),
  );
  return node("div", { class: "table-scroll" }, [
    node("table", {}, [...head, node("tbody", {}, body)]),
  ]);
}

function physicsTree(data) {
  const physics = data.physics;
  const parts = [node("h2", {}, [text("物理仕様")])];
  const schema = physics["physics/schema"];
  if (typeof schema === "string" && schema) parts.push(node("p", { class: "muted" }, [text(schema)]));
  for (const kase of physics.cases) {
    const rows = Object.entries(kase).map(([key, value]) =>
      [keyNode(key), node("dd", {}, [valueNode(value)])],
    ).flat();
    parts.push(node("section", {}, [
      node("h3", {}, [text(String(kase.id))]),
      node("dl", {}, rows),
    ]));
  }
  return node("div", {}, parts);
}

// P1 原稿, read-only: entries bundled at build time from
// docs/manuscripts/p1.edn are shown as data; when the repository carries no
// manuscript file the tab says so instead of showing fabricated content.
// There is no write or save path here, and none is added until the
// localStorage schema v2 and a consent gate exist.
function manuscriptTree(data) {
  const parts = [node("h2", {}, [text("原稿")])];
  const entries = data.manuscript?.entries;
  if (Array.isArray(entries) && entries.length > 0) {
    for (const entry of entries) {
      const rows = Object.entries(entry).map(([key, value]) =>
        [keyNode(key), node("dd", {}, [valueNode(value)])]).flat();
      parts.push(node("section", {}, [
        node("h3", {}, [text(String(entry.id ?? entry.title ?? entry.name ?? "原稿"))]),
        node("dl", {}, rows),
      ]));
    }
  } else {
    parts.push(node("p", { class: "sample-note" }, [text("原稿は未登録です。この app にバンドルされたリポジトリデータには原稿が含まれていません。")]));
  }
  parts.push(node("p", { class: "muted" }, [text("この画面は読み取り専用です。書き込み・保存は行いません。書き込み・保存を足す場合は、localStorage の schema 追加（itonami.series.isco2641.v1 → v2）と同意ゲートが別途必要であり、schema v2 と同意ゲートが揃うまで実装しません。")]));
  return node("div", {}, parts);
}

function aboutTree(data) {
  const identity = data.identity;
  const digests = Object.entries(data.sources).map(([path, digest]) =>
    node("li", {}, [text(`${path}: ${digest}`)]),
  );
  return node("div", {}, [
    node("h2", {}, [text("この app について")]),
    node("dl", {}, [
      node("dt", {}, [text("id")]), node("dd", {}, [text(identity.id)]),
      node("dt", {}, [text("バージョン")]), node("dd", {}, [text(data.version)]),
      node("dt", {}, [text("分類")]), node("dd", {}, [text(identity.classification)]),
      node("dt", {}, [text("ローカル保存")]), node("dd", {}, [text(identity.stateSchema)]),
      node("dt", {}, [text("外部通信")]),
      node("dd", {}, [text("なし。この app は外部へ通信しません。操作の宣言 (operations) はありません。")]),
    ]),
    node("h3", {}, [text("ソースダイジェスト")]),
    node("ul", {}, digests),
  ]);
}

/** Any EDN-decoded value becomes display nodes, shown as it is in the source. */
export function valueNode(value) {
  if (value === null || value === undefined) return node("span", { class: "muted" }, [text("—")]);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return node("span", {}, [text(String(value))]);
  }
  if (Array.isArray(value)) {
    return node("ul", {}, value.map((item) => node("li", {}, [valueNode(item)])));
  }
  if (typeof value === "object") {
    if (typeof value.symbol === "string" && Object.keys(value).length === 1) {
      return node("span", {}, [text(value.symbol)]);
    }
    if (Array.isArray(value.list)) {
      return node("ul", {}, value.list.map((item) => node("li", {}, [valueNode(item)])));
    }
    const rows = Object.entries(value).map(([key, child]) =>
      [keyNode(key), node("dd", {}, [valueNode(child)])],
    ).flat();
    return node("dl", {}, rows);
  }
  return node("span", {}, [text(String(value))]);
}

/** Keyboard navigation for the tablist: the id that should become active. */
export function nextTab(tabs, currentId, key) {
  const ids = tabs.map((t) => t.id);
  const at = ids.indexOf(currentId);
  const from = at < 0 ? 0 : at;
  if (key === "ArrowRight" || key === "ArrowDown") return ids[(from + 1) % ids.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return ids[(from - 1 + ids.length) % ids.length];
  if (key === "Home") return ids[0];
  if (key === "End") return ids[ids.length - 1];
  return ids[from];
}

/** The stored tab id when it names a current tab, else null. Never throws. */
export function readSelectedTab(storage, key, tabs) {
  try {
    const saved = storage ? storage.getItem(key) : null;
    return tabs.some((t) => t.id === saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Remember the tab id. Never throws: the app still renders without it. */
export function writeSelectedTab(storage, key, id) {
  try {
    if (storage) storage.setItem(key, id);
  } catch {
    // Local storage may be unavailable or read-only; the tab still switches.
  }
}

/**
 * Build a DOM element from a tree. Uses createElement, setAttribute,
 * textContent and appendChild only: no innerHTML, no inline script or style.
 */
export function toElement(doc, tree) {
  if (tree.tag === undefined) return doc.createTextNode(tree.text ?? "");
  const el = doc.createElement(tree.tag);
  for (const [name, value] of Object.entries(tree.attrs || {})) {
    el.setAttribute(name, value);
  }
  for (const child of tree.children || []) el.appendChild(toElement(doc, child));
  return el;
}

// A key cell: the key text split after '.', '/' and '-', with a <wbr>
// between the pieces, so a long key (for example
// 'itonami.blueprint/domain') wraps only at those boundaries and never in
// the middle of a word. Keys without any of those characters never wrap.
// Paired with dt { overflow-wrap: normal } in style.css, the browser takes
// only these <wbr> break opportunities.
function keyNode(key) {
  const parts = String(key).split(/(?<=[./-])/).filter((part) => part !== "");
  const children = [];
  for (const [index, part] of parts.entries()) {
    if (index > 0) children.push(node("wbr", {}, []));
    children.push(text(part));
  }
  return node("dt", {}, children);
}

function node(tag, attrs, children) {
  return { tag, attrs, children };
}

function text(value) {
  return { text: value };
}
