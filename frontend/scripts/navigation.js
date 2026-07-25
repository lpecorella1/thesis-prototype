function switchToTab(target) {
  tabs.forEach((item) => item.classList.toggle("is-active", item.dataset.tabTarget === target));
  panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.tabPanel === target));
  sectionLinks.forEach((item) => item.classList.toggle("is-active", item.dataset.sectionLinkTarget === target));

  const heroGoalPanel = document.querySelector("[data-hero-goal-panel]");
  if (heroGoalPanel) {
    heroGoalPanel.hidden = target === "home";
  }

  if (target !== "grocery" && groceryArRuntime.stream) {
    stopGroceryArCamera();
  }
}

function getDefaultTabTarget() {
  return "home";
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchToTab(tab.dataset.tabTarget);
  });
});

homeCards.forEach((button) => {
  button.addEventListener("click", () => {
    switchToTab(button.dataset.homeTarget);
  });
});

sectionLinks.forEach((button) => {
  button.addEventListener("click", () => {
    switchToTab(button.dataset.sectionLinkTarget);
  });
});

homeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchToTab("home");
  });
});

recipeSwitches.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.recipeTarget;

    recipeSwitches.forEach((item) => item.classList.remove("mode-pill-active"));
    recipePanels.forEach((panel) => panel.classList.remove("is-active"));

    button.classList.add("mode-pill-active");
    document.querySelector(`[data-recipe-panel="${target}"]`)?.classList.add("is-active");
  });
});

switchToTab(getDefaultTabTarget());

mobileHomeMediaQuery.addEventListener("change", (event) => {
  const activeTab = document.querySelector(".app-section.is-active")?.dataset.tabPanel;

  if (!event.matches && activeTab === "home") {
    switchToTab("home");
  }
});
