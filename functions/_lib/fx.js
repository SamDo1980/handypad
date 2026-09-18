const DEFAULT_FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const HARDCODED_FALLBACK_RATE = 26000;

export async function getUsdToVndRate(env) {
  const apiUrl = env.FX_API_URL || DEFAULT_FX_API_URL;
  const fallback = Number(env.FX_FALLBACK_USD_VND) || HARDCODED_FALLBACK_RATE;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`FX API trả về mã lỗi ${res.status}`);
    const data = await res.json();
    const rate = Number(data?.rates?.VND);
    if (!rate || Number.isNaN(rate)) throw new Error("Phản hồi FX API không có tỷ giá VND hợp lệ");
    return rate;
  } catch (err) {
    console.error("Lấy tỷ giá USD->VND trực tiếp thất bại, dùng tỷ giá dự phòng:", err.message);
    return fallback;
  }
}
