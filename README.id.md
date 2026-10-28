# Falcon Tracker (Bahasa Indonesia)

**Pelacak GPS LoRa open-source untuk falconry.** Tag kecil di tubuh falcon membaca
posisi dari modul GPS+BeiDou lalu mengirimkannya lewat LoRa 433 MHz. Base station
yang tersambung ke laptop menerima data tersebut dan menampilkan setiap burung
secara langsung di peta: jejak terbang, jarak dan arah dari Anda, level baterai,
dan kekuatan sinyal.

Link radio tidak butuh internet, SIM card, atau langganan. (Peta latar butuh
internet saat pertama kali membuka suatu area.)

Dokumentasi lengkap berbahasa Inggris ada di [README.md](README.md) dan folder [docs/](docs/).

## Langkah cepat

### 1. Coba aplikasi tanpa hardware

```bash
cd app
python -m pip install -e .
python -m falcon_tracker --demo
```

Browser akan membuka <http://localhost:8000> dengan dua falcon simulasi.
Di Windows cukup klik dua kali `START_DEMO.bat` (atau `START_DASHBOARD.bat` untuk alat sungguhan).

Dashboard punya kartu status (TRACKING / NO GPS FIX / LOW BATTERY / SIGNAL LOST), peta live, grafik baterai, kecepatan, ketinggian dan sinyal, serial monitor, pengaturan, dan panduan, dengan gaya yang sama seperti proyek Anda yang lain.

### 2. Flash firmware

Pasang [PlatformIO](https://platformio.org/install) (extension VS Code atau `pip install platformio`), lalu:

```bash
cd firmware
pio run -e tx -t upload      # tag falcon
pio run -e rx -t upload      # base station
```

Setiap tag falcon harus punya id berbeda: ubah `-D DEVICE_ID=1` di `platformio.ini`
sebelum mem-flash tag berikutnya.

### 3. Lacak

Colokkan base station ke laptop, nyalakan tag di luar ruangan (fix GPS pertama
butuh 30–60 detik di langit terbuka), lalu jalankan:

```bash
python -m falcon_tracker                # deteksi otomatis ESP32-C3
python -m falcon_tracker --port COM5    # Windows, jika deteksi otomatis gagal
```

Klik **Base = my location** atau **Set base on map** agar aplikasi bisa
menampilkan jarak dan arah ke falcon.

## Wiring singkat

| Sinyal | ESP32-C3 | XL1278-SMT | ATGM336H (hanya TX) |
|---|---|---|---|
| 3.3 V | 3V3 | 3.3V | VCC |
| GND | GND | GND | GND |
| SCK | GPIO4 | SCK | |
| MISO | GPIO5 | MISO | |
| MOSI | GPIO6 | MOSI | |
| NSS / CS | GPIO7 | NSS | |
| RESET | GPIO10 | RESET | |
| DIO0 | GPIO3 | DIO0 | |
| GPS → ESP | GPIO20 (RX) | | TX |
| ESP → GPS | GPIO21 (TX) | | RX |
| Baterai/2 | GPIO0 (ADC) | | |

Baterai 1S: `+` → saklar → dioda SS14 → pin **5V**; `−` → **GND**. Pembagi tegangan
100k/100k dari baterai ke GPIO0 untuk membaca level baterai. Detail lengkap,
daftar komponen, dan estimasi daya ada di [docs/hardware.md](docs/hardware.md).

> **Penting:** jangan pernah menyalakan modul LoRa tanpa antena terpasang, karena
> bisa merusak modul.

## Regulasi & kesejahteraan hewan

- Aturan frekuensi 433 MHz berbeda di tiap negara. Periksa aturan regulator lokal
  (mis. Komdigi/SDPPI di Indonesia) dan sesuaikan `firmware/include/config.h`.
- Berat total tag sebaiknya jauh di bawah 3–5 % berat badan burung. Gunakan
  tail-mount atau backpack khusus falconry dan uji di sarung tangan sebelum terbang bebas.
