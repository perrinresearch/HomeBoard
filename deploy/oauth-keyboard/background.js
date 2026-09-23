chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab || !sender.tab.id || !message || !message.type) {
    return;
  }
  chrome.tabs.sendMessage(sender.tab.id, message).catch(() => {});
});
