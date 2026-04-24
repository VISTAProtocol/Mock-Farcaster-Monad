export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userWallet = searchParams.get("userWallet");

  if (!userWallet) {
    return Response.json({ campaigns: [] });
  }

  const dashboardUrl =
    process.env.NEXT_PUBLIC_VISTA_DASHBOARD_URL ?? "http://localhost:3031";

  try {
    const res = await fetch(
      `${dashboardUrl}/api/campaigns/active?userWallet=${encodeURIComponent(userWallet)}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${process.env.VISTA_DASHBOARD_TOKEN || ""}`,
        },
      },
    );
    console.log("RERULT", res);

    if (!res.ok) {
      return Response.json({ campaigns: [] });
    }

    const data = await res.json();
    return Response.json({
      campaigns: Array.isArray(data) ? data : (data.campaigns ?? []),
    });
  } catch (err) {
    console.error("[API] Failed to fetch campaigns:", err);
    return Response.json({ campaigns: [] });
  }
}
