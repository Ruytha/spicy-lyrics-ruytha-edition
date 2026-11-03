// Romanization Under the Lyrics on Spicy's renderer: the romanization as a smaller row
// at the bottom of the line (Mixed.css), so it scrolls, dims and highlights with it.
export function AppendRomanLine(lineElem: HTMLElement, text: string): void {
  if (!text) return;
  const roman = document.createElement("div");
  roman.className = "SL_RomanLine";
  roman.textContent = text;
  lineElem.appendChild(roman);
  lineElem.classList.add("HasRomanLine");
}
