Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

$rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 13, 15, 20)), ([System.Drawing.Color]::FromArgb(255, 27, 32, 44)), 45
$g.FillEllipse($bgBrush, 4, 4, 504, 504)

$ringPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 255, 255, 255)), 2
$g.DrawEllipse($ringPen, 6, 6, 500, 500)

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

$barWidth = 26
$gap = 20
$count = 7
$total = ($count * $barWidth) + (($count - 1) * $gap)
$startX = ($size - $total) / 2
$heights = @(96, 168, 264, 344, 264, 168, 96)

$barRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$barBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $barRect, ([System.Drawing.Color]::FromArgb(255, 124, 58, 237)), ([System.Drawing.Color]::FromArgb(255, 34, 211, 238)), 0

for ($i = 0; $i -lt $count; $i++) {
  $h = $heights[$i]
  $x = $startX + ($i * ($barWidth + $gap))
  $y = ($size - $h) / 2
  $path = New-RoundedPath $x $y $barWidth $h ($barWidth / 2)
  $g.FillPath($barBrush, $path)
  $path.Dispose()
}

$g.Dispose()
$outDir = Join-Path $PSScriptRoot ''
$out = Join-Path $outDir 'avatar.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output ("wrote {0} ({1} bytes)" -f $out, (Get-Item $out).Length)
