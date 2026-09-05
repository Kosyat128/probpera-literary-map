/** Newly authored preparation copy. Editorial/legal approval is a later explicit
 * evidence gate; this module never declares AI output production reviewed. */
export const planetAccountCopy = {
  reviewStatus: "draft", productionReady: false,
  locales: {
    ru: {
      access: "Восстановление доступа", deletion: "Удаление аккаунта", intro: "Войдите в существующий аккаунт «Пробы Пера», чтобы проверить доступ к «Литературной планете».",
      signIn: "Войти в аккаунт", restore: "Восстановить доступ", busy: "Проверяем…", retry: "Повторить", journal: "Открыть журнал", close: "Закрыть",
      unavailable: "Сервис сейчас недоступен. Повторите попытку позже.", authentication: "Войдите в аккаунт и повторите попытку.",
      reauthentication: "Для удаления нужно снова подтвердить вход в аккаунт.", denied: "Не удалось подтвердить доступ к этой операции.", signInAgain: "Войти снова",
      deletionIntro: "Перед отправкой запроса прочитайте, какие данные будут удалены и какие сведения сохранятся.",
      disclosureUnavailable: "Сведения об удалении сейчас недоступны. Отправить запрос можно будет, когда они появятся.",
      consent: "Я прочитал сведения об удалении и хочу отправить запрос на удаление моего аккаунта.", submitDeletion: "Запросить удаление аккаунта",
      requested: "Запрос принят. Удаление ещё не завершено. Сохраните номер запроса для обращения в поддержку.", requestNumber: "Номер запроса", support: "Написать в поддержку",
      processing: "Запрос обрабатывается. Удаление ещё не завершено.", blocked: "Обработка запроса приостановлена. Обратитесь в поддержку с номером запроса.", completed: "Сервер подтвердил завершение удаления.",
      checkStatus: "Проверить статус запроса", statusUnknown: "Не удалось проверить статус удаления. Повторите проверку перед отправкой нового запроса.",
      statusInfo: "Статус доступен после входа в тот же аккаунт. Если войти уже нельзя, обратитесь в поддержку с сохранённым номером запроса. Ошибка входа сама по себе не подтверждает удаление.",
      deleteLink: "Удаление аккаунта и данных", accessLink: "Восстановление доступа к приложению", loadingAccount: "Загружаем вход в аккаунт…",
    },
    en: {
      access: "Restore access", deletion: "Delete your account", intro: "Sign in to your existing Proba Pera account to check your Literary Planet access.",
      signIn: "Sign in", restore: "Restore access", busy: "Checking…", retry: "Try again", journal: "Open the journal", close: "Close",
      unavailable: "The service is unavailable right now. Please try again later.", authentication: "Sign in to your account and try again.",
      reauthentication: "Please sign in again to confirm your identity before requesting account deletion.", denied: "Your access to this operation could not be verified.", signInAgain: "Sign in again",
      deletionIntro: "Before sending a request, read which data will be deleted and which records will be retained.",
      disclosureUnavailable: "Deletion information is unavailable right now. You can send a request when it becomes available.",
      consent: "I have read the deletion information and want to request deletion of my account.", submitDeletion: "Request account deletion",
      requested: "Your request has been received. Deletion is not yet complete. Save your request number in case you need to contact support.", requestNumber: "Request number", support: "Contact support",
      processing: "Your request is being processed. Deletion is not yet complete.", blocked: "Your request is on hold. Contact support with your request number.", completed: "The server has confirmed that deletion is complete.",
      checkStatus: "Check request status", statusUnknown: "The deletion status could not be checked. Check again before sending a new request.",
      statusInfo: "Sign in to the same account to check its request. If you can no longer sign in, contact support with your saved request number. A sign-in error alone does not confirm deletion.",
      deleteLink: "Account and data deletion", accessLink: "Restore app access", loadingAccount: "Loading account sign-in…",
    },
  },
} as const;
