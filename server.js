const http = require("http");
const url = require("url");

const PORT = 3000;

const personeller = [
  "Furkan Gloria",
  "Pinar Gloria",
  "Flooki Gloria",
  "Tigani Gloria"
];

let kayitlar = {};

function simdiTarih() {
  return new Date().toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul"
  });
}

function simdiSaat() {
  return new Date().toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul"
    hour: "2-digit",
    minute: "2-digit"
  });
}

function dakika(ms) {
  return Math.max(0, Math.round(ms / 60000));
}

function sureYaz(dk) {
  let saat = Math.floor(dk / 60);
  let kalan = dk % 60;
  if (saat > 0) return saat + " saat " + kalan + " dk";
  return kalan + " dk";
}

function sayfa() {
  let options = "";
  personeller.forEach(function(p) {
    options += "<option value='" + p + "'>" + p + "</option>";
  });

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Gloria PDKS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:Arial;background:#111;color:white;margin:0;padding:20px;max-width:520px;margin:auto}
h1{color:#ff8a00}
.card{background:#222;padding:18px;border-radius:15px;margin:15px 0}
select,button{width:100%;padding:15px;margin:7px 0;border-radius:12px;border:0;font-size:18px}
button{font-weight:bold}
.giris{background:#22c55e}
.mola{background:#facc15}
.donus{background:#38bdf8}
.cikis{background:#ef4444;color:white}
table{width:100%;border-collapse:collapse}
td,th{border-bottom:1px solid #444;padding:8px;text-align:left;font-size:14px}
th{color:#ff8a00}
</style>
</head>
<body>

<h1>GLORIA JEANS PDKS</h1>

<div class="card">
<select id="personel">${options}</select>
<button class="giris" onclick="islem('giris')">Vardiya Giriş</button>
<button class="mola" onclick="islem('mola')">Molaya Çık</button>
<button class="donus" onclick="islem('donus')">Moladan Dön</button>
<button class="cikis" onclick="islem('cikis')">Vardiya Çıkış</button>
<p id="sonuc"></p>
</div>

<div class="card">
<h2>Günlük Durum</h2>
<div id="liste"></div>
</div>

<script>
function islem(tip){
  var p = document.getElementById("personel").value;
  fetch("/islem?tip=" + tip + "&p=" + encodeURIComponent(p))
  .then(r => r.text())
  .then(t => {
    document.getElementById("sonuc").innerText = t;
    liste();
  });
}

function liste(){
  fetch("/liste")
  .then(r => r.text())
  .then(t => document.getElementById("liste").innerHTML = t);
}

liste();
setInterval(liste, 5000);
</script>

</body>
</html>`;
}

const server = http.createServer(function(req, res) {
  const q = url.parse(req.url, true);
  const yol = q.pathname;
  const p = q.query.p;
  const tip = q.query.tip;

  if (yol === "/") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    res.end(sayfa());
    return;
  }

  if (yol === "/islem") {
    if (!p) {
      res.end("Personel seçilmedi");
      return;
    }

    if (!kayitlar[p]) {
      kayitlar[p] = {
        giris: "",
        girisMs: 0,
        cikis: "",
        cikisMs: 0,
        molaToplam: 0,
        molaAktif: false,
        molaBaslaMs: 0
      };
    }

    let k = kayitlar[p];

    if (tip === "giris") {
      k.giris = simdiSaat();
      k.girisMs = Date.now();
      k.cikis = "";
      k.cikisMs = 0;
      k.molaToplam = 0;
      k.molaAktif = false;
      res.end(p + " vardiya giriş yaptı: " + k.giris);
      return;
    }

    if (tip === "mola") {
      if (!k.girisMs) {
        res.end("Önce vardiya giriş yapmalı");
        return;
      }
      if (k.molaAktif) {
        res.end(p + " zaten molada");
        return;
      }
      k.molaAktif = true;
      k.molaBaslaMs = Date.now();
      res.end(p + " molaya çıktı: " + simdiSaat());
      return;
    }

    if (tip === "donus") {
      if (!k.molaAktif) {
        res.end(p + " molada görünmüyor");
        return;
      }
      let molaDk = dakika(Date.now() - k.molaBaslaMs);
      k.molaToplam += molaDk;
      k.molaAktif = false;
      k.molaBaslaMs = 0;
      res.end(p + " moladan döndü. Mola: " + molaDk + " dk");
      return;
    }

    if (tip === "cikis") {
      if (!k.girisMs) {
        res.end("Önce vardiya giriş yapmalı");
        return;
      }

      if (k.molaAktif) {
        let ekstra = dakika(Date.now() - k.molaBaslaMs);
        k.molaToplam += ekstra;
        k.molaAktif = false;
      }

      k.cikis = simdiSaat();
      k.cikisMs = Date.now();

      let calisma = dakika(k.cikisMs - k.girisMs) - k.molaToplam;
      if (calisma < 0) calisma = 0;

      res.end(p + " vardiya çıkış yaptı. Çalışma: " + sureYaz(calisma) + " | Mola: " + sureYaz(k.molaToplam));
      return;
    }

    res.end("İşlem bulunamadı");
    return;
  }

  if (yol === "/liste") {
    let html = "<table>";
    html += "<tr><th>İsim Soyisim</th><th>Durum</th><th>Giriş</th><th>Çıkış</th><th>Mola</th><th>Çalışma</th></tr>";

    Object.keys(kayitlar).forEach(function(ad) {
      let k = kayitlar[ad];
      let durum = "Çalışıyor";
      if (k.molaAktif) durum = "Molada";
      if (k.cikis) durum = "Çıkış yaptı";

      let mola = k.molaToplam;
      if (k.molaAktif) mola += dakika(Date.now() - k.molaBaslaMs);

      let calisma = 0;
      if (k.girisMs) {
        let bitis = k.cikisMs || Date.now();
        calisma = dakika(bitis - k.girisMs) - mola;
        if (calisma < 0) calisma = 0;
      }

      html += "<tr>";
      html += "<td>" + ad + "</td>";
      html += "<td>" + durum + "</td>";
      html += "<td>" + (k.giris || "-") + "</td>";
      html += "<td>" + (k.cikis || "-") + "</td>";
      html += "<td>" + sureYaz(mola) + "</td>";
      html += "<td>" + sureYaz(calisma) + "</td>";
      html += "</tr>";
    });

    html += "</table>";

    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    res.end(html);
    return;
  }

  res.end("Sayfa yok");
});

server.listen(PORT, function() {
  console.log("Sistem calisiyor:");
  console.log("http://localhost:3000");
});