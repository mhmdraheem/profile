class SecureContactForm {
  constructor() {
    this.form = document.getElementById("contactForm");
    this.submitBtn = document.getElementById("submit-btn");
    this.formStatus = document.getElementById("form-status");
    this.csrfToken = "";

    this.init();
  }

  async init() {
    await this.getCsrfToken();
    this.setupEventListeners();
  }

  async getCsrfToken() {
    try {
      const response = await fetch("/csrf-token");
      const data = await response.json();
      this.csrfToken = data.csrfToken;
    } catch (error) {
      console.error("Error getting CSRF token:", error);
    }
  }

  setupEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  showFormStatus(message, type) {
    this.formStatus.textContent = message;
    this.formStatus.className = `form-status ${type}`;
  }

  hideFormStatus() {
    this.formStatus.className = "form-status";
  }

  setLoading(isLoading) {
    this.submitBtn.disabled = isLoading;
    this.submitBtn.classList.toggle("loading", isLoading);
  }

  async handleSubmit(e) {
    e.preventDefault();
    this.hideFormStatus();

    if (!this.form.checkValidity()) {
      this.showFormStatus("يرجى تصحيح الأخطاء في النموذج", "error");
      return;
    }

    this.setLoading(true);
    try {
      const formData = new FormData(this.form);
      const data = Object.fromEntries(formData.entries());

      const response = await fetch("/submit-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        this.showFormStatus(result.message, "success");
        this.form.reset();
        this.form.querySelectorAll(".valid, .invalid").forEach((field) => {
          field.classList.remove("valid", "invalid");
        });
        // Refresh CSRF token
        await this.getCsrfToken();
      } else {
        if (result.errors && Array.isArray(result.errors)) {
          this.showFormStatus(result.errors.join("، "), "error");
        } else {
          this.showFormStatus(result.message || "حدث خطأ أثناء إرسال الرسالة", "error");
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      this.showFormStatus("حدث خطأ في الاتصال. يرجى المحاولة لاحقاً.", "error");
    } finally {
      this.setLoading(false);
    }
  }
}

// Initialize the form when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SecureContactForm();
});
