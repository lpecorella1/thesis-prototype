const tabs = document.querySelectorAll("[data-tab-target]");
const panels = document.querySelectorAll("[data-tab-panel]");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tabTarget;

    tabs.forEach((item) => item.classList.remove("is-active"));
    panels.forEach((panel) => panel.classList.remove("is-active"));

    tab.classList.add("is-active");
    document.querySelector(`[data-tab-panel="${target}"]`)?.classList.add("is-active");
  });
});

const recipeSwitches = document.querySelectorAll("[data-recipe-target]");
const recipePanels = document.querySelectorAll("[data-recipe-panel]");

recipeSwitches.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.recipeTarget;

    recipeSwitches.forEach((item) => item.classList.remove("mode-pill-active"));
    recipePanels.forEach((panel) => panel.classList.remove("is-active"));

    button.classList.add("mode-pill-active");
    document.querySelector(`[data-recipe-panel="${target}"]`)?.classList.add("is-active");
  });
});
