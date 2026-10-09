document.addEventListener("DOMContentLoaded", () => {

    /*
     * RE:FOUND
     * Global UI interactions
     */

    const toasts = document.querySelectorAll(".toast");

    toasts.forEach((toast) => {

        setTimeout(() => {

            toast.classList.add("hide");

            setTimeout(() => {
                toast.remove();
            }, 350);

        }, 4500);

    });


    /*
     * Prevent double submit
     */

    const forms = document.querySelectorAll("form");

    forms.forEach((form) => {

        form.addEventListener("submit", () => {

            const button = form.querySelector(
                'button[type="submit"]'
            );

            if (!button) {
                return;
            }

            if (form.dataset.submitting === "true") {
                return;
            }

            form.dataset.submitting = "true";

            button.disabled = true;

            const originalText = button.innerHTML;

            button.dataset.originalText = originalText;

            button.innerHTML = "Memproses...";

            setTimeout(() => {

                button.disabled = false;

                button.innerHTML =
                    button.dataset.originalText;

                form.dataset.submitting = "false";

            }, 8000);

        });

    });


    /*
     * Mobile menu helper
     */

    const menuButton =
        document.querySelector("[data-menu-button]");

    const mobileMenu =
        document.querySelector("[data-mobile-menu]");

    if (menuButton && mobileMenu) {

        menuButton.addEventListener("click", () => {

            mobileMenu.classList.toggle("open");

        });

    }


    /*
     * Smooth anchor navigation
     */

    document.querySelectorAll('a[href^="#"]').forEach((link) => {

        link.addEventListener("click", (event) => {

            const targetId =
                link.getAttribute("href");

            if (!targetId || targetId === "#") {
                return;
            }

            const target =
                document.querySelector(targetId);

            if (!target) {
                return;
            }

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });

});