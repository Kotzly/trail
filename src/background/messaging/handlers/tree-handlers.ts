
export async function handleTreeMessage(
  message: any,
  sender: chrome.runtime.MessageSender
): Promise<any> {
  console.warn("handleTreeMessage", "no-op, this message is not supported");
  return { success: false, error: 'Unknown tree message type' };
}
