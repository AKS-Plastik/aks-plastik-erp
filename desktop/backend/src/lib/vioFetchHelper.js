async function getDecodedText(response) {
  const arrayBuffer = await response.arrayBuffer();
  const decoder = new TextDecoder('windows-1254');
  let text = decoder.decode(arrayBuffer);
  if (text.startsWith('ï»¿')) {
    text = text.substring(3);
  } else if (text.charCodeAt(0) === 0xFEFF) {
    text = text.substring(1);
  }
  return text;
}

module.exports = { getDecodedText };
