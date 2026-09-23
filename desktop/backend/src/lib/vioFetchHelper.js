async function getDecodedText(response) {
  let text = await response.text();
  if (text.startsWith('ï»¿') || text.startsWith('\uFEFF')) {
    text = text.replace(/^ï»¿|^\uFEFF/, '');
  }

  // Fix literal corrupted Turkish characters coming from Vio's legacy data
  text = text.replace(/¦-/g, 'İ');
  text = text.replace(/\+Ş/g, 'Ş');

  return text;
}

module.exports = { getDecodedText };
