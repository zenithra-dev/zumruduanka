# Ses günlüğü

Gitar sesini gerçek bir elektro gitara yaklaştırma denemeleri. Her deneme tek değişken; ölçüm üç araçla (README, "Ses tasarımı döngüsü"), son karar dinleyerek.

**Ölçüm kuralları**

- Akort: `node tools/tuning.mjs '<STRING json>'`, ortalama |hata| 0.5 sentin altında kalmalı.
- Yazılım kulak: `SEEDS=1,2,3,4,5 node tools/sweep.mjs P <varyantlar>`. Karşılaştırma P'ye göre aynı tohumdaki fark (eşleştirilmiş fark). Tek tohuma bakılmaz: P'nin kendisi tohumdan tohuma 21/−8/−6/13/30 arasında oynuyor, tek tohumla 22'ye 8 gibi farklar gürültü.
- Dinleme örnekleri: `node tools/guitar-samples.mjs <etiket> '<varyant json>'` → `out/guitar/*-<etiket>.mp3` (tohum 1, 10 sn).

## 0. Taban: e4c7943 (2026-10-13)

- Akort: ortalama 0.22 sent, en kötü midi 74 (−0.8).
- Yazılım kulak, 5 tohum: toplam 10 ±15. riff: elektro gitar 4, gitar 8, distorsiyon 33. En zayıf klip kaf: alçak tellerde tek nota riff "synth + klavye" 33 okunuyor.
- Tek nota (`tools/note.mjs`): E2'de 8. harmonik temelden ancak biraz hızlı sönüyor (−1.6'ya −0.9 dB/sn). Kalın teller uzun ve parlak çınlıyor, gerçek telde üst harmonikler çok daha çabuk söner. Sürdürüm denemesinin adayı.

## 1. İkinci polarizasyon, `STRING.dual` (2026-10-13)

**Değişen:** tel modeline ikinci (yatay) polarizasyon. Varsayılan kapalı (`dual: 0`), kulak kararı bekleniyor.

**Literatür:**

- İki düzlemin frekans farkı etkin tel boyundan gelir, yani sabit oran: yaklaşık 2 sent, yatay daha pes (Brauchler, Ziegler, Eberhard, DAGA 2019; Woodhouse, Acta Acustica 90, 2004).
- Manyetik yatay hareketi yaklaşık on kat bastırır (Horton ve Moore, Am. J. Phys. 77, 2009), görünen karışım ~0.1.
- Solid-body'de iki düzlemin Q'su benzer, ölü notalar dışında (Paté, Le Carrou, Fabre, JASA 135, 2014).

**Uygulamada düzeltilenler:**

- Eski `dual` ikinci çizgi için kendi `rand()` değerlerini çekiyordu. Açılınca sonraki tüm notaların pena gürültüsü kayıyordu, yani A/B tek değişkenli değildi. Şimdi iki düzlem aynı pena darbesini paylaşıyor (tek temas ikisini birlikte uyarır). `dual: 0` iken ham tel tamponu eski kodla birebir aynı (732 060 örnekte fark 0, palm mute dahil); rastgele dizi `dual`'dan bağımsız.
- `dual` artık gerçek genlik oranı. Eskiden iki çizgi ayrı ayrı normalize edildiği için `dual: 0.2` aslında %36'lık bir kopyaydı.
- Ana tel tam akortta. İki çizgiyi akordun iki yanına genlikle ağırlıklı koymak denendi: zayıf çizgi kısa pencerede perdeyi çekmiyor (yüksek harmoniklerin çapraz terimleri dönüyor), ana tel 0.56 sent kaydı.

**Sonuçlar** (akort: ortalama |hata|; kulak: P'ye göre eşleştirilmiş fark, 5 tohum. Z3, Z4, Z5 kornaların da cezalandırıldığı son ölçümden; diğerlerinde korna çıkmadığı için iki ölçüm aynı):

| Varyant | Ayar | Akort | Kulak | Not |
|---|---|---|---|---|
| P | kapalı | 0.22 | 0 | |
| Z1 | 0.1, −2 sent (ölçülen fiziksel değer) | 0.19 | −5 (1/5) | kulak ayırmıyor |
| P4 | 0.2, −2 sent | 0.17 | −7 (1/5) | |
| Z7 | 0.1, −2 sent, yatay 1.4 kat uzun | 0.19 | −5 (1/5) | sönüm farkı etkisiz |
| Z8 | −0.1 (ters faz) | 0.24 | +15 (5/5) | |
| Z2 | 0.1, −5 sent | 0.22 | +7 (4/5) | |
| Z3 | 0.1, −10 sent | 0.22 | +74 (5/5) | kaf: kötü 33 → 12, gitar 3 → 15 |
| Z5 | 0.1, +10 sent | 0.27 | +81 (5/5) | lead'de hafif korna |
| Z4 | 0.1, −20 sent | 0.34 | +86 (5/5) | lead'de korna %11 |

**Yorum:** yazılım kulak fiziksel değeri (2 sent) ayırmıyor. Puanı yükselten 10 sent ve üstü; bu polarizasyondan çok, çok hafif bir chorus ya da çift tel etkisi. Kazancın çoğu kaf'ın alçak tel riffinden geliyor (synth/klavye okuması düşüyor, gitar 3'ten 15-19'a, elektro gitar 1'den 6-9'a çıkıyor). 20 sentte lead ton korna gibi okunmaya başlıyor. Kulak hakem değil; 10 sent kulağa 12 telli ya da chorus pedalı gibi gelirse fiziksel değer (Z1) seçilmeli.

**Dinleme örnekleri:** `out/guitar/{kaf,riff,elise,tepegoz}-{p0,z1-fiziksel,z3-10sent,z4-20sent}.mp3`

**Kulak kararı:** bekleniyor.
