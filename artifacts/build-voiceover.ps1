$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskOutput = Join-Path $PSScriptRoot 'tapsynk-promo'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
$taskLines = @(
  'You made the connection. Now keep the conversation going!',
  'Meet Tap Synk. One tap shares your business profile. No app needed!',
  'With the A I Card, customers can ask about your services, even while you are busy.',
  'Help them take the next step, and book an available appointment.',
  'Capture contacts they choose to share. Track activity in your dashboard.',
  'Your premium smart card is included. Update your details without a reprint.',
  'Ready to see it work for your business? Book your free fifteen minute Tap Synk demo today!'
)
$taskVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$taskVoice.SelectVoice('Microsoft Zira Desktop')
$taskVoice.Rate = 2
$taskVoice.Volume = 100
for ($taskIndex=0; $taskIndex -lt $taskLines.Count; $taskIndex++) {
  $taskVoice.SetOutputToWaveFile((Join-Path $taskOutput ('voice-{0}.wav' -f $taskIndex)))
  $taskVoice.Speak($taskLines[$taskIndex])
  $taskVoice.SetOutputToNull()
}
$taskVoice.Dispose()
