import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  selectMatches,
  setSearchQuery,
} from "@codemirror/search";
import { runScopeHandlers, type EditorView, type Panel, type ViewUpdate } from "@codemirror/view";

export const CHEVRON = "M6 3.5 10.5 8 6 12.5";
const CLOSE = "M4.5 4.5l7 7M11.5 4.5l-7 7";

export function icon(path: string, rotate = 0) {
  const style = rotate ? ` style="transform: rotate(${rotate}deg)"` : "";
  return `<svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${style}><path d="${path}"/></svg>`;
}

const TEMPLATE = `
  <div class="cm-search-row">
    <input class="cm-search-field" name="search" form="" placeholder="Найти" aria-label="Найти" main-field="true" autocomplete="off" spellcheck="false">
    <button type="button" class="cm-search-icon" name="prev" title="Предыдущее (Shift+Enter)" aria-label="Предыдущее">${icon(CHEVRON, -90)}</button>
    <button type="button" class="cm-search-icon" name="next" title="Следующее (Enter)" aria-label="Следующее">${icon(CHEVRON, 90)}</button>
    <button type="button" class="cm-search-button" name="select">Все</button>
    <button type="button" class="cm-search-toggle" name="case" title="Учитывать регистр" aria-pressed="false">Aa</button>
    <button type="button" class="cm-search-toggle" name="re" title="Регулярное выражение" aria-pressed="false">.*</button>
    <button type="button" class="cm-search-toggle" name="word" title="Слово целиком" aria-pressed="false">Слово</button>
    <button type="button" class="cm-search-icon" name="close" title="Закрыть (Escape)" aria-label="Закрыть поиск">${icon(CLOSE)}</button>
  </div>
  <div class="cm-search-row">
    <input class="cm-search-field" name="replace" form="" placeholder="Заменить на" aria-label="Заменить на" autocomplete="off" spellcheck="false">
    <button type="button" class="cm-search-button" name="replace">Заменить</button>
    <button type="button" class="cm-search-button" name="replaceAll">Заменить все</button>
  </div>
`;

export function createSearchPanel(view: EditorView): Panel {
  const dom = document.createElement("div");
  dom.className = "cm-search-panel";
  dom.innerHTML = TEMPLATE;

  const field = (name: string) => dom.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const button = (name: string) => dom.querySelector<HTMLButtonElement>(`button[name="${name}"]`)!;
  const searchField = field("search");
  const replaceField = field("replace");
  const toggles = { caseSensitive: button("case"), regexp: button("re"), wholeWord: button("word") };

  let current = getSearchQuery(view.state);

  const show = (query: SearchQuery) => {
    current = query;
    searchField.value = query.search;
    replaceField.value = query.replace;
    toggles.caseSensitive.setAttribute("aria-pressed", String(query.caseSensitive));
    toggles.regexp.setAttribute("aria-pressed", String(query.regexp));
    toggles.wholeWord.setAttribute("aria-pressed", String(query.wholeWord));
  };

  const commit = () => {
    const query = new SearchQuery({
      search: searchField.value,
      replace: replaceField.value,
      caseSensitive: toggles.caseSensitive.getAttribute("aria-pressed") === "true",
      regexp: toggles.regexp.getAttribute("aria-pressed") === "true",
      wholeWord: toggles.wholeWord.getAttribute("aria-pressed") === "true",
    });
    if (query.eq(current)) return;
    current = query;
    view.dispatch({ effects: setSearchQuery.of(query) });
  };

  show(current);

  searchField.addEventListener("input", commit);
  replaceField.addEventListener("input", commit);
  for (const toggle of Object.values(toggles)) {
    toggle.addEventListener("click", () => {
      toggle.setAttribute("aria-pressed", String(toggle.getAttribute("aria-pressed") !== "true"));
      commit();
    });
  }
  button("prev").addEventListener("click", () => findPrevious(view));
  button("next").addEventListener("click", () => findNext(view));
  button("select").addEventListener("click", () => selectMatches(view));
  button("close").addEventListener("click", () => closeSearchPanel(view));
  button("replace").addEventListener("click", () => replaceNext(view));
  button("replaceAll").addEventListener("click", () => replaceAll(view));

  dom.addEventListener("keydown", (event) => {
    if (runScopeHandlers(view, event, "search-panel")) {
      event.preventDefault();
    } else if (event.key === "Enter" && event.target === searchField) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(view);
    } else if (event.key === "Enter" && event.target === replaceField) {
      event.preventDefault();
      replaceNext(view);
    }
  });

  return {
    dom,
    top: false,
    mount: () => searchField.select(),
    update: (update: ViewUpdate) => {
      for (const transaction of update.transactions) {
        for (const effect of transaction.effects) {
          if (effect.is(setSearchQuery) && !effect.value.eq(current)) show(effect.value);
        }
      }
    },
  };
}
