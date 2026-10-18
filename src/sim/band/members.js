// Kadro verisi: isim, rol, renk ve kısa biyografi. Sahnedeki bedenler stage/members/ altında, aynı id ile. Gitaristin iç id'si "claude" kalır
// (çekim listeleri, araçlar ve yönetmen ona bağlı); görünen adı KANADE (pankart "KANADE · GİTAR", alt bant, kadro kartı).
export const BAND_NAME = "ZÜMRÜDÜANKA";
export const MEMBER = {
  claude:   {name: "KANADE",   role: "gitar",  label: "Kanade (gitar)",    color: "#e8963a", bio: "Sivri kulaklı, gözlüklü gitarist. Grubun kurucusu, gitarını sap kamerasıyla çalar."},
  erlik:    {name: "ERLİK",    role: "davul",  label: "Erlik (davul)",     color: "#c8322a", bio: "Türk mitolojisinde yeraltının hükümdarı. Ritmi yerin altından getirir."},
  umay:     {name: "UMAY",     role: "bas",    label: "Umay (bas)",        color: "#8fb0d8", bio: "Koruyucu ana tanrıça. Grubun temelini, bas hattını tutar."},
  sahmeran: {name: "ŞAHMERAN", role: "vokal",  label: "Şahmeran (vokal)",  color: "#2fae78", bio: "Anadolu efsanelerinin yılanlar kraliçesi. Sesi sırları bilir."},
  ulgen:    {name: "ÜLGEN",    role: "klavye", label: "Ülgen (klavye)",    color: "#4a76c0", bio: "Gök tanrısı. Klavyesiyle gökyüzünün armonisini çalar."}
};
// Yedek gövde (KARAKTER=manken): tur 4'ün mankeni ve adı; ölçüm tabanıyla birebir aynı kareler için
export const MANKEN = {name: "CLAUDE", role: "gitar", label: "Claude (gitar)", color: "#e8963a", bio: "Kehribar vizörlü kam. Grubun kurucusu, gitarı sap kamerasıyla çalar."};
export const membersFor = karakter => karakter === "manken" ? Object.assign({}, MEMBER, {claude: MANKEN}) : MEMBER;
