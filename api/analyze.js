const SYS = `তুমি SebaAI, একজন সহায়ক যে সাধারণ মানুষকে মেডিকেল রিপোর্ট সহজ বাংলায় বুঝিয়ে দেয়। ব্যবহারকারী রিপোর্টের ছবি, বয়স, লিঙ্গ ও সমস্যা দেবে। রিপোর্টটা কীসের, প্রতিটি পরীক্ষার ফল (নাম, ফলাফল, স্বাভাবিক মান, স্ট্যাটাস: স্বাভাবিক/একটু বেশি-কম/অনেক বেশি-কম), কঠিন শব্দের মানে, ভালো দিক, মনোযোগের দিক, এবং ডাক্তারকে জিজ্ঞেস করার ৫টি নির্দিষ্ট প্রশ্ন দাও। সহজ চলিত বাংলা ব্যবহার করো, ইংরেজি শব্দের পাশে বাংলা মানে দাও। রোগ নির্ণয়, ওষুধ বা চিকিৎসা দেবে না। ভয় দেখাবে না, গুরুতর কিছু থাকলে urgent=true দেবে। অস্পষ্ট ছবিতে অনুমান করবে না। মেডিকেল রিপোর্ট না হলে ভদ্রভাবে জানাবে। নাম ও ফোন নম্বর উত্তরে লিখবে না।`;

const FORMAT = `শুধু একটি JSON অবজেক্ট ফেরত দাও, আর কিছু নয় (কোনো ব্যাখ্যা বা মার্কডাউন ছাড়া)। ফরম্যাট:
{"status":"ok"|"unclear"|"not_report","urgent":true|false,"summary":"রিপোর্টটা কীসের (২-৩ বাক্য)",
"tests":[{"name":"","result":"","normal":"","status":"normal"|"mild"|"severe"}],
"terms":[{"word":"","meaning":""}],"good":[""],"attention":[""],"questions":["৫টি প্রশ্ন"]}
ছবি অস্পষ্ট হলে status="unclear", মেডিকেল রিপোর্ট না হলে status="not_report" দাও (বাকি ক্ষেত্র খালি রাখো)।
status মান: normal=স্বাভাবিক, mild=একটু বেশি/কম, severe=অনেক বেশি/কম।`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  try {
    const { image, age, gender, problem, history } = req.body || {};
    if (typeof image !== "string" || image.length < 100 || image.length > 4_000_000)
      return res.status(400).json({ error: "bad_image" });

    const info = `বয়স: ${String(age || "জানানো হয়নি").slice(0, 3)}
লিঙ্গ: ${String(gender || "জানানো হয়নি").slice(0, 20)}
সমস্যা: ${String(problem || "জানানো হয়নি").slice(0, 300)}
চলমান ওষুধ/আগের রোগ: ${String(history || "নেই").slice(0, 300)}

${FORMAT}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.MODEL || "claude-sonnet-5-5",
        max_tokens: 4000,
        system: SYS,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: info },
          ],
        }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "upstream" });

    const d = await r.json();
    const t = d.content.map((x) => x.text || "").join("");
    res.status(200).json(JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)));
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
