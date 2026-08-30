export type EditorialSliderLabels = {
  region: (sliderIndex: number, imageCount: number) => string;
  previous: string;
  next: string;
  pause: string;
  resume: string;
  selection: string;
  show: (imageIndex: number, imageCount: number) => string;
  status: (imageIndex: number, imageCount: number) => string;
};

function enabled(value: string | undefined, fallback: boolean) {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function sliderInterval(value: string | undefined) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 15000
    ? parsed
    : 5000;
}

function directSlides(slider: HTMLElement) {
  return [...slider.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      (child.tagName === "IMG" ||
        (child.matches("figure.article-gallery-item") &&
          Boolean(child.querySelector("img"))))
  );
}

export function initializeEditorialSliders(
  root: HTMLElement,
  labels: EditorialSliderLabels
) {
  const cleanups: Array<() => void> = [];

  root
    .querySelectorAll<HTMLElement>(".article-design-block.is-slider")
    .forEach((slider, sliderIndex) => {
      const slides = directSlides(slider);
      const images = slides.map((slide) =>
        slide instanceof HTMLImageElement
          ? slide
          : slide.querySelector<HTMLImageElement>("img")
      );
      if (!slides.length || images.some((image) => !image)) return;

      const showArrows = enabled(slider.dataset.sliderArrows, true);
      const showDots = enabled(slider.dataset.sliderDots, true);
      const loop = enabled(slider.dataset.sliderLoop, true);
      const autoplay =
        enabled(slider.dataset.sliderAutoplay, false) &&
        slides.length > 1 &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const interval = sliderInterval(slider.dataset.sliderInterval);
      const sliderSnapshot = {
        tabindex: slider.getAttribute("tabindex"),
        role: slider.getAttribute("role"),
        label: slider.getAttribute("aria-label"),
        roleDescription: slider.getAttribute("aria-roledescription"),
      };
      const slideSnapshots = slides.map((slide, index) => ({
        slide,
        className: slide.className,
        ariaHidden: slide.getAttribute("aria-hidden"),
        inert: slide.hasAttribute("inert"),
        role: slide.getAttribute("role"),
        roleDescription: slide.getAttribute("aria-roledescription"),
        label: slide.getAttribute("aria-label"),
        image: images[index]!,
        imageTabIndex: images[index]!.getAttribute("tabindex"),
      }));

      slider.classList.add("is-interactive");
      slider.tabIndex = 0;
      slider.setAttribute("role", "region");
      slider.setAttribute("aria-roledescription", "carousel");
      slider.setAttribute("aria-label", labels.region(sliderIndex + 1, slides.length));

      let activeIndex = 0;
      let touchStartX: number | null = null;
      let hoverPaused = false;
      let focusPaused = false;
      let userPaused = false;
      let timer: number | undefined;

      const controls = document.createElement("div");
      controls.className = `article-slider-controls${showArrows ? " has-arrows" : ""}${showDots ? " has-dots" : ""}${autoplay ? " has-autoplay" : ""}`;

      const previousButton = showArrows ? document.createElement("button") : null;
      if (previousButton) {
        previousButton.type = "button";
        previousButton.className = "article-slider-arrow is-previous";
        previousButton.setAttribute("aria-label", labels.previous);
        previousButton.textContent = "←";
        controls.append(previousButton);
      }

      const dots = showDots ? document.createElement("div") : null;
      if (dots) {
        dots.className = "article-slider-dots";
        dots.setAttribute("role", "group");
        dots.setAttribute("aria-label", labels.selection);
        controls.append(dots);
      }

      const dotButtons = showDots
        ? slides.map((_, imageIndex) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "article-slider-dot";
            button.setAttribute("aria-label", labels.show(imageIndex + 1, slides.length));
            dots!.append(button);
            return button;
          })
        : [];

      const nextButton = showArrows ? document.createElement("button") : null;
      if (nextButton) {
        nextButton.type = "button";
        nextButton.className = "article-slider-arrow is-next";
        nextButton.setAttribute("aria-label", labels.next);
        nextButton.textContent = "→";
        controls.append(nextButton);
      }

      const autoplayButton = autoplay ? document.createElement("button") : null;
      if (autoplayButton) {
        autoplayButton.type = "button";
        autoplayButton.className = "article-slider-autoplay";
        autoplayButton.setAttribute("aria-label", labels.pause);
        autoplayButton.setAttribute("aria-pressed", "false");
        autoplayButton.textContent = "Ⅱ";
        controls.append(autoplayButton);
      }

      const status = document.createElement("span");
      status.className = "article-slider-status";
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      controls.append(status);
      slider.append(controls);

      const normalizeIndex = (nextIndex: number) =>
        loop
          ? (nextIndex + slides.length) % slides.length
          : Math.min(slides.length - 1, Math.max(0, nextIndex));

      const update = (nextIndex: number) => {
        activeIndex = normalizeIndex(nextIndex);
        slideSnapshots.forEach((snapshot, imageIndex) => {
          const isActive = imageIndex === activeIndex;
          snapshot.slide.classList.toggle("is-active", isActive);
          snapshot.slide.setAttribute("role", "group");
          snapshot.slide.setAttribute("aria-roledescription", "slide");
          snapshot.slide.setAttribute(
            "aria-label",
            labels.show(imageIndex + 1, slides.length)
          );
          snapshot.slide.setAttribute("aria-hidden", String(!isActive));
          snapshot.slide.toggleAttribute("inert", !isActive);
          if (isActive) {
            if (snapshot.imageTabIndex === null) {
              snapshot.image.removeAttribute("tabindex");
            } else {
              snapshot.image.setAttribute("tabindex", snapshot.imageTabIndex);
            }
          } else {
            snapshot.image.tabIndex = -1;
          }
        });
        dotButtons.forEach((button, imageIndex) => {
          const isActive = imageIndex === activeIndex;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-current", isActive ? "true" : "false");
        });
        if (previousButton) previousButton.disabled = !loop && activeIndex === 0;
        if (nextButton) nextButton.disabled = !loop && activeIndex === slides.length - 1;
        status.textContent = labels.status(activeIndex + 1, slides.length);
      };

      const canAutoplay = () =>
        autoplay &&
        !userPaused &&
        !hoverPaused &&
        !focusPaused &&
        !document.hidden &&
        (loop || activeIndex < slides.length - 1);
      const scheduleAutoplay = () => {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
        if (!canAutoplay()) return;
        timer = window.setTimeout(() => {
          update(activeIndex + 1);
          scheduleAutoplay();
        }, interval);
      };
      const showPrevious = (event?: Event) => {
        event?.preventDefault();
        event?.stopPropagation();
        update(activeIndex - 1);
        scheduleAutoplay();
      };
      const showNext = (event?: Event) => {
        event?.preventDefault();
        event?.stopPropagation();
        update(activeIndex + 1);
        scheduleAutoplay();
      };
      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") showPrevious(event);
        if (event.key === "ArrowRight") showNext(event);
      };
      const handleTouchStart = (event: TouchEvent) => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
      };
      const handleTouchEnd = (event: TouchEvent) => {
        const touchEndX = event.changedTouches[0]?.clientX;
        if (touchStartX === null || touchEndX === undefined) return;
        const distance = touchEndX - touchStartX;
        touchStartX = null;
        if (Math.abs(distance) < 42) return;
        if (distance > 0) showPrevious(event);
        else showNext(event);
      };
      const handleMouseEnter = () => {
        hoverPaused = true;
        scheduleAutoplay();
      };
      const handleMouseLeave = () => {
        hoverPaused = false;
        scheduleAutoplay();
      };
      const handleFocusIn = () => {
        focusPaused = true;
        scheduleAutoplay();
      };
      const handleFocusOut = (event: FocusEvent) => {
        if (event.relatedTarget instanceof Node && slider.contains(event.relatedTarget)) return;
        focusPaused = false;
        scheduleAutoplay();
      };
      const handleVisibility = () => scheduleAutoplay();
      const toggleAutoplay = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        userPaused = !userPaused;
        if (autoplayButton) {
          autoplayButton.setAttribute("aria-pressed", String(userPaused));
          autoplayButton.setAttribute(
            "aria-label",
            userPaused ? labels.resume : labels.pause
          );
          autoplayButton.textContent = userPaused ? "▶" : "Ⅱ";
        }
        scheduleAutoplay();
      };

      previousButton?.addEventListener("click", showPrevious);
      nextButton?.addEventListener("click", showNext);
      autoplayButton?.addEventListener("click", toggleAutoplay);
      dotButtons.forEach((button, imageIndex) => {
        const handler = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          update(imageIndex);
          scheduleAutoplay();
        };
        button.addEventListener("click", handler);
        cleanups.push(() => button.removeEventListener("click", handler));
      });
      slider.addEventListener("keydown", handleKeydown);
      slider.addEventListener("touchstart", handleTouchStart, { passive: true });
      slider.addEventListener("touchend", handleTouchEnd, { passive: false });
      slider.addEventListener("mouseenter", handleMouseEnter);
      slider.addEventListener("mouseleave", handleMouseLeave);
      slider.addEventListener("focusin", handleFocusIn);
      slider.addEventListener("focusout", handleFocusOut);
      document.addEventListener("visibilitychange", handleVisibility);
      update(0);
      scheduleAutoplay();

      cleanups.push(() => {
        if (timer !== undefined) window.clearTimeout(timer);
        previousButton?.removeEventListener("click", showPrevious);
        nextButton?.removeEventListener("click", showNext);
        autoplayButton?.removeEventListener("click", toggleAutoplay);
        slider.removeEventListener("keydown", handleKeydown);
        slider.removeEventListener("touchstart", handleTouchStart);
        slider.removeEventListener("touchend", handleTouchEnd);
        slider.removeEventListener("mouseenter", handleMouseEnter);
        slider.removeEventListener("mouseleave", handleMouseLeave);
        slider.removeEventListener("focusin", handleFocusIn);
        slider.removeEventListener("focusout", handleFocusOut);
        document.removeEventListener("visibilitychange", handleVisibility);
        controls.remove();
        slider.classList.remove("is-interactive");
        for (const [name, value] of Object.entries({
          tabindex: sliderSnapshot.tabindex,
          role: sliderSnapshot.role,
          "aria-label": sliderSnapshot.label,
          "aria-roledescription": sliderSnapshot.roleDescription,
        })) {
          if (value === null) slider.removeAttribute(name);
          else slider.setAttribute(name, value);
        }
        slideSnapshots.forEach((snapshot) => {
          snapshot.slide.className = snapshot.className;
          for (const [name, value] of Object.entries({
            "aria-hidden": snapshot.ariaHidden,
            role: snapshot.role,
            "aria-roledescription": snapshot.roleDescription,
            "aria-label": snapshot.label,
            tabindex: snapshot.imageTabIndex,
          })) {
            const target = name === "tabindex" ? snapshot.image : snapshot.slide;
            if (value === null) target.removeAttribute(name);
            else target.setAttribute(name, value);
          }
          snapshot.slide.toggleAttribute("inert", snapshot.inert);
        });
      });
    });

  return () => cleanups.reverse().forEach((cleanup) => cleanup());
}
