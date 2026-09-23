async function getDecodedText(response) {
  let text = await response.text();
  if (text.startsWith('ï»¿') || text.startsWith('\uFEFF')) {
    text = text.replace(/^ï»¿|^\uFEFF/, '');
  }
  return text;
}

module.exports = { getDecodedText };
