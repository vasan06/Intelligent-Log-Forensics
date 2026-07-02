const input = document.getElementById("fileInput");
const zone = document.getElementById("dropZone");
const nameLabel = document.getElementById("fileName");
const metaLabel = document.getElementById("fileMeta");

function showFile(file) {
  if (!file) return;
  nameLabel.textContent = file.name;
  metaLabel.textContent = `${(file.size / 1024).toFixed(1)} KB · ready for analysis`;
  zone.classList.add("has-file");
}

input.addEventListener("change", () => showFile(input.files[0]));
["dragenter", "dragover"].forEach(type => zone.addEventListener(type, event => {
  event.preventDefault();
  zone.classList.add("dragging");
}));
["dragleave", "drop"].forEach(type => zone.addEventListener(type, event => {
  event.preventDefault();
  zone.classList.remove("dragging");
}));
zone.addEventListener("drop", event => {
  input.files = event.dataTransfer.files;
  showFile(input.files[0]);
});
