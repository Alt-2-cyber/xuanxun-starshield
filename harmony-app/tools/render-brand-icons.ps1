# Rebuild local PNG launch assets from the same shield geometry as brand_shield.svg.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$appVisualRoot = Split-Path -Parent $PSScriptRoot
$foregroundTargets = @(
  'AppScope/resources/base/media/foreground.png',
  'entry/src/main/resources/base/media/foreground.png'
)
$backgroundTargets = @(
  'AppScope/resources/base/media/background.png',
  'entry/src/main/resources/base/media/background.png'
)
$shield = New-Object System.Drawing.Bitmap 512, 512
$drawing = [System.Drawing.Graphics]::FromImage($shield)
$drawing.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$drawing.Clear([System.Drawing.Color]::Transparent)
$pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#D8EDAA')), 12
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$outline = New-Object System.Drawing.Drawing2D.GraphicsPath
$outline.AddLines([System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(256, 74),
  [System.Drawing.PointF]::new(396, 124),
  [System.Drawing.PointF]::new(396, 252)
))
$outline.AddBezier(396, 252, 396, 330, 322, 385, 256, 420)
$outline.AddBezier(256, 420, 190, 385, 116, 330, 116, 252)
$outline.AddLine(116, 252, 116, 124)
$outline.CloseFigure()
$drawing.DrawPath($pen, $outline)
$drawing.DrawLines($pen, [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(184, 190),
  [System.Drawing.PointF]::new(328, 190),
  [System.Drawing.PointF]::new(184, 310),
  [System.Drawing.PointF]::new(328, 310)
))
$drawing.DrawLine($pen, 256, 134, 256, 166)
$drawing.DrawLine($pen, 256, 334, 256, 366)
foreach ($asset in $foregroundTargets) {
  $shield.Save((Join-Path $appVisualRoot $asset), [System.Drawing.Imaging.ImageFormat]::Png)
}
$background = New-Object System.Drawing.Bitmap 512, 512
$backgroundDrawing = [System.Drawing.Graphics]::FromImage($background)
$backgroundDrawing.Clear([System.Drawing.ColorTranslator]::FromHtml('#101614'))
foreach ($asset in $backgroundTargets) {
  $background.Save((Join-Path $appVisualRoot $asset), [System.Drawing.Imaging.ImageFormat]::Png)
}
$backgroundDrawing.DrawImage($shield, 0, 0, 512, 512)
$background.Save((Join-Path $appVisualRoot 'entry/src/main/resources/base/media/startIcon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$backgroundDrawing.Dispose()
$background.Dispose()
$outline.Dispose()
$pen.Dispose()
$drawing.Dispose()
$shield.Dispose()
Write-Output 'Rendered five ZHIXUN FIRE launch assets.'
