import { isSafePublicHref } from "./public-href";

export type HomepageSettingsInput = {
  eyebrow: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  articleIdsText?: string;
};

export const HOMEPAGE_BUTTON_URL_ERROR =
  "Ссылка кнопки должна начинаться с /, #, https:// или mailto:";

export function isSafeHomepageButtonUrl(value: string) {
  return isSafePublicHref(value, {
    allowEmpty: true,
    allowHash: true,
    allowMailto: true,
  });
}

export function homepageSettingsPatch(input: HomepageSettingsInput) {
  if (!isSafeHomepageButtonUrl(input.buttonUrl)) {
    throw new Error(HOMEPAGE_BUTTON_URL_ERROR);
  }
  const patch: {
    eyebrow: string;
    description: string;
    buttonText: string;
    buttonUrl: string;
    articleIds?: string[];
  } = {
    eyebrow: input.eyebrow,
    description: input.description,
    buttonText: input.buttonText,
    buttonUrl: input.buttonUrl,
  };

  if (input.articleIdsText !== undefined) {
    patch.articleIds = input.articleIdsText
      .split(/[\s,;]+/u)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 24);
  }

  return patch;
}
