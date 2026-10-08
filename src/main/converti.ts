// Tutte le foto diventano PNG prima di entrare nell'app: così maschera, anteprime e motore vedono gli stessi pixel.
// Come in DaP-Convertitore: le immagini passano da WIC, il motore di Windows, che legge HEIC, i RAW delle
// fotocamere, TIFF, JXL e WEBP/AVIF con le estensioni di Windows, gira la foto come la vede il telefono
// (orientamento EXIF) e porta i colori in sRGB. JPG, WEBP, AVIF, GIF e BMP di solito li apre già l'interfaccia
// (Chromium): WIC serve per tutto il resto, o quando Chromium non ce la fa.
import { execFile } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { TEMP, assicura } from './percorsi'

/** quelle che Chromium non sa aprire: vanno subito a WIC */
export const SOLO_WIC = /\.(heic|heif|hif|tif|tiff|dng|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|rw2|pef|srw|x3f|3fr|erf|kdc|mrw|jxl|jxr|wdp|hdp|dds)$/i

/** tutte le estensioni che si provano ad aprire */
export const ESTENSIONI_FOTO = ['png', 'jpg', 'jpeg', 'jfif', 'webp', 'avif', 'gif', 'bmp', 'ico', 'heic', 'heif', 'hif', 'tif', 'tiff', 'dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'raf', 'orf', 'rw2', 'pef', 'srw', 'jxl', 'jxr']

// Lo stesso giro di ApriConWic del convertitore (StorageFile → BitmapDecoder → SoftwareBitmap BGRA già girata e in
// sRGB), qui in PowerShell 5.1 che parla con WinRT. Alfa dritta (non premoltiplicata): il PNG la vuole così.
const SCRIPT = String.raw`
param([string]$Entrata, [string]$Uscita, [int]$LatoMax = 0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$metodi = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = ($metodi | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation${'`'}1' })[0]
$asTaskAz = ($metodi | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' })[0]
function Attendi($op, [Type]$tipo) { $t = $asTaskOp.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
function AttendiAzione($op) { $t = $asTaskAz.Invoke($null, @($op)); $t.Wait(-1) | Out-Null }
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapEncoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
$file = Attendi ([Windows.Storage.StorageFile]::GetFileFromPathAsync([System.IO.Path]::GetFullPath($Entrata))) ([Windows.Storage.StorageFile])
$flusso = Attendi ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$dec = Attendi ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($flusso)) ([Windows.Graphics.Imaging.BitmapDecoder])
$t = New-Object Windows.Graphics.Imaging.BitmapTransform
$t.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
$lungo = [Math]::Max($dec.OrientedPixelWidth, $dec.OrientedPixelHeight)
if ($LatoMax -gt 0 -and $lungo -gt $LatoMax) {
  $s = $LatoMax / [double]$lungo
  $t.ScaledWidth = [uint32][Math]::Max(1, [Math]::Round($dec.PixelWidth * $s))
  $t.ScaledHeight = [uint32][Math]::Max(1, [Math]::Round($dec.PixelHeight * $s))
}
$bmp = Attendi ($dec.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Straight, $t, [Windows.Graphics.Imaging.ExifOrientationMode]::RespectExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::ColorManageToSRgb)) ([Windows.Graphics.Imaging.SoftwareBitmap])
$mem = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
$enc = Attendi ([Windows.Graphics.Imaging.BitmapEncoder]::CreateAsync([Windows.Graphics.Imaging.BitmapEncoder]::PngEncoderId, $mem)) ([Windows.Graphics.Imaging.BitmapEncoder])
$enc.SetSoftwareBitmap($bmp)
AttendiAzione ($enc.FlushAsync())
$letto = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($mem.GetInputStreamAt(0))
$fs = [System.IO.File]::Create($Uscita)
$letto.CopyTo($fs)
$fs.Close()
Write-Output ("{0}x{1}" -f $bmp.PixelWidth, $bmp.PixelHeight)
`

let scriptScritto = ''
function percorsoScript(): string {
  if (scriptScritto && existsSync(scriptScritto)) return scriptScritto
  assicura(TEMP)
  scriptScritto = join(TEMP, 'wic-png.ps1')
  // con il BOM PowerShell 5.1 legge l'UTF-8 giusto anche con le lettere accentate nei percorsi
  writeFileSync(scriptScritto, '﻿' + SCRIPT, 'utf8')
  return scriptScritto
}

/** una foto qualsiasi → PNG in TEMP, con WIC (solo su Windows). Lato massimo 0 = grandezza piena. */
export function pngConWic(entrata: string, latoMax = 0): Promise<{ percorso: string; larghezza: number; altezza: number }> {
  return new Promise((ok, ko) => {
    if (process.platform !== 'win32') {
      ko(new Error('questo formato si apre solo su Windows'))
      return
    }
    const uscita = join(TEMP, `${randomUUID().slice(0, 8)}-wic.png`)
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', percorsoScript(), '-Entrata', entrata, '-Uscita', uscita, '-LatoMax', String(latoMax)],
      { windowsHide: true, timeout: 120_000, maxBuffer: 4 << 20 },
      (err, out, errori) => {
        const m = /(\d+)x(\d+)/.exec(String(out))
        if (err || !m || !existsSync(uscita)) {
          const motivo = String(errori || err?.message || '').split('\n').find((r) => r.trim()) || ''
          ko(new Error(`Questa immagine non si riesce ad aprire${/HEIC|HEIF|0x88982F50|componente/i.test(motivo + entrata) ? ' (per le HEIC Windows vuole le "Estensioni immagine HEIF" dallo Store)' : ''}.`))
          return
        }
        ok({ percorso: uscita, larghezza: Number(m[1]), altezza: Number(m[2]) })
      }
    )
  })
}
