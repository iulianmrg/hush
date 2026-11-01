export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();

    const name = String(data.name || "").trim();
    const instagram = String(data.instagram || "").trim().replace(/^@/, "");
    const email = String(data.email || "").trim().toLowerCase();
    const turnstileToken = String(data.turnstileToken || "");

    // Validate form fields
    if (
      !name ||
      !instagram ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      name.length > 100 ||
      instagram.length > 50 ||
      email.length > 254
    ) {
      return Response.json(
        { error: "Please check your details." },
        { status: 400 }
      );
    }

    // Require Turnstile verification
    if (!turnstileToken) {
      return Response.json(
        { error: "Please complete the security verification." },
        { status: 400 }
      );
    }

    // Verify token with Cloudflare
    const verification = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET,
          response: turnstileToken
        })
      }
    );

    const result = await verification.json();

    if (!result.success) {
      return Response.json(
        { error: "Security verification failed. Please try again." },
        { status: 403 }
      );
    }

    // Save verified registration
    await env.HUSH_DB
      .prepare(
        "INSERT INTO private_list (name, instagram, email) VALUES (?, ?, ?)"
      )
      .bind(name, instagram, email)
      .run();

    return Response.json({ success: true });

  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return Response.json(
        { error: "This email is already registered." },
        { status: 409 }
      );
    }

    return Response.json(
      { error: "Could not save your request." },
      { status: 500 }
    );
  }
}
