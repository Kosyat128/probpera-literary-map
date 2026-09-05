/** Newly authored RU/EN preparation copy. Human review remains required. */
export const passwordRecoveryCopy = {
  reviewStatus: "draft", productionReady: false,
  locales: {
    ru: {
      open: "Забыли пароль?", close: "Скрыть восстановление пароля", title: "Восстановить пароль", email: "Электронная почта аккаунта",
      send: "Отправить ссылку", sent: "Если для этого адреса доступно восстановление, вы получите письмо со ссылкой. Проверьте почту и папку «Спам».",
      password: "Новый пароль", confirm: "Повторите новый пароль", save: "Сохранить новый пароль", busy: "Выполняем запрос…",
      instruction: "Откройте ссылку из письма, затем задайте новый пароль — не менее 10 символов.",
      updated: "Пароль изменён. Войдите в аккаунт с новым паролем.", signIn: "Войти с новым паролем",
      errors: { unavailable: "Не удалось выполнить запрос. Повторите попытку позже.", "recovery-required": "Сессия восстановления не подтверждена или срок ссылки истёк. Запросите новое письмо.",
        changed: "Сессия аккаунта изменилась. Откройте ссылку восстановления ещё раз.", "invalid-email": "Введите корректный адрес электронной почты.",
        "invalid-password": "Пароли должны совпадать и содержать от 10 до 1024 символов.", "captcha-required": "Пройдите проверку защиты от автоматических запросов.",
        "updated-signout-incomplete": "Пароль изменён, но завершение выхода из аккаунта не подтверждено. Выйдите из аккаунта и войдите с новым паролем." },
    },
    en: {
      open: "Forgot your password?", close: "Hide password recovery", title: "Reset your password", email: "Account email address",
      send: "Send recovery link", sent: "If password recovery is available for this address, you will receive an email with a link. Check your inbox and spam folder.",
      password: "New password", confirm: "Confirm new password", save: "Save new password", busy: "Processing your request…",
      instruction: "Open the link in your email, then choose a new password with at least 10 characters.",
      updated: "Your password has been changed. Sign in with your new password.", signIn: "Sign in with new password",
      errors: { unavailable: "The request could not be completed. Please try again later.", "recovery-required": "Your recovery session could not be verified or the link has expired. Request a new email.",
        changed: "Your account session changed. Open the recovery link again.", "invalid-email": "Enter a valid email address.",
        "invalid-password": "Passwords must match and contain between 10 and 1024 characters.", "captcha-required": "Complete the protection check against automated requests.",
        "updated-signout-incomplete": "Your password has changed, but sign-out could not be confirmed. Sign out, then sign in with your new password." },
    },
  },
} as const;
