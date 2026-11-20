import { handleBackgroundMessage } from "@/services/background-message.service";
import { recoverInterruptedSyncs } from "@/storage/sync.storage";
import { browser } from "wxt/browser";

export default defineBackground(() => {
  const recoveryPromise = recoverInterruptedSyncs();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void recoveryPromise
      .then(() => handleBackgroundMessage(message, sender))
      .then((response) => {
        if (response !== undefined) {
          sendResponse(response);
        }
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected background error.",
        });
      });

    return true;
  });
});
