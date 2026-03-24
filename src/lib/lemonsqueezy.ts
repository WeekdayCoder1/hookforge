export async function createCheckoutSession(
  userEmail: string,
  userId: string,
): Promise<string> {
  const API_KEY = process.env.LEMONSQUEEZY_API_KEY;
  const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID;
  const VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID;

  if (!API_KEY || !STORE_ID || !VARIANT_ID) {
    throw new Error("Missing Lemon Squeezy environment variables");
  }

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: userEmail,
          custom: {
            user_id: userId,
          },
        },
      },
      relationships: {
        store: {
          data: { type: "stores", id: STORE_ID },
        },
        variant: {
          data: { type: "variants", id: VARIANT_ID },
        },
      },
    },
  };

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Accept": "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Lemon Squeezy API error:", JSON.stringify(error, null, 2));
    const firstError = error?.errors?.[0]?.detail || "Failed to create checkout session";
    throw new Error(`Lemon Squeezy error: ${firstError}`);
  }

  const data = await response.json();
  const checkoutUrl = data.data?.attributes?.url;

  if (!checkoutUrl) {
    throw new Error("No checkout URL returned from Lemon Squeezy");
  }

  return checkoutUrl;
}