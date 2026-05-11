(() => {
  const storageKey = "chemgl-theme";
  const savedTheme = localStorage.getItem(storageKey);
  const systemTheme =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  const theme =
    savedTheme === "light" || savedTheme === "dark" ? savedTheme : systemTheme;
  document.body.dataset.theme = theme;
})();
