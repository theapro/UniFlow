$ErrorActionPreference = 'Stop'

$workspaceRoot = 'C:\Users\Apro\Documents\UniFlow'
$historyRoot = "$env:APPDATA\Code\User\History"

if (!(Test-Path -LiteralPath $historyRoot)) {
  throw "VS Code History folder not found: $historyRoot"
}

$targetsRel = @(
  'admin/app/[lang]/dashboard/ai-debug-console/page.tsx',
  'admin/app/[lang]/dashboard/ai-models/page.tsx',
  'admin/app/[lang]/dashboard/ai-monitor/page.tsx',
  'admin/app/[lang]/dashboard/page.tsx',
  'admin/app/[lang]/dashboard/students/[id]/view/page.tsx',
  'admin/app/[lang]/dashboard/subjects/create/page.tsx',
  'admin/app/[lang]/dashboard/teachers/[id]/view/page.tsx',
  'admin/app/[lang]/dashboard/testai/page.tsx',
  'admin/app/[lang]/login/page.tsx',
  'admin/components/auth/ProtectedRoute.tsx',
  'admin/components/chart-area-interactive.tsx',
  'admin/components/section-cards.tsx',
  'admin/components/shared/DataTable.tsx',
  'admin/components/students/StudentTable.tsx',
  'admin/components/subjects/SubjectDetailView.tsx',
  'admin/components/subjects/SubjectsView.tsx',
  'admin/components/teachers/TeacherTable.tsx',
  'admin/components/uniflow-sidebar.tsx',
  'admin/lib/api.ts',
  'admin/types/auth.types.ts',

  'backend/prisma/schema.prisma',
  'backend/prisma/seed.ts',

  'backend/src/ai/context/buildContext.ts',
  'backend/src/ai/core/AiClassifier.ts',
  'backend/src/ai/core/AiResponder.ts',
  'backend/src/ai/services/LlmService.ts',
  'backend/src/ai/tools/access.ts',
  'backend/src/ai/tools/adminTools.ts',
  'backend/src/ai/tools/studentTools.ts',
  'backend/src/ai/tools/teacherTools.ts',
  'backend/src/ai/tools/toolRegistry.ts',
  'backend/src/ai/tools/scheduleTools.ts',
  'backend/src/ai/types.ts',

  'backend/src/config/prisma.ts',
  'backend/src/controllers/admin/AdminAiTestController.ts',
  'backend/src/controllers/ai/AiDebugRunController.ts',
  'backend/src/controllers/auth/AuthController.ts',
  'backend/src/controllers/user/AttendanceController.ts',
  'backend/src/controllers/user/ScheduleController.ts',
  'backend/src/middlewares/auth.middleware.ts',
  'backend/src/middlewares/role.middleware.ts',
  'backend/src/routes/admin.routes.ts',
  'backend/src/routes/ai.routes.ts',
  'backend/src/routes/index.ts',
  'backend/src/routes/user.routes.ts',
  'backend/src/services/ai-tools/toolNames.ts',
  'backend/src/services/ai/AiModelService.ts',
  'backend/src/services/ai/AiToolConfigService.ts',
  'backend/src/services/attendance-sheets/AttendanceSheetsSyncService.ts',
  'backend/src/services/attendance-sheets/AttendanceSheetsWorker.ts',
  'backend/src/services/attendance-sheets/attendanceStatusMap.ts',
  'backend/src/services/grades-sheets/GradesSheetsSyncService.ts',
  'backend/src/services/scheduling/AiGroupLayoutService.ts',
  'backend/src/services/sheets/SheetsSettingsService.ts',
  'backend/src/services/sync/derivedRelations.ts',
  'backend/src/services/user/StudentService.ts',
  'backend/src/types/express.d.ts',

  'user/src/app/dashboard/page.tsx',
  'user/src/components/user-menu.tsx',
  'user/src/lib/permissions.ts',

  'admin/app/[lang]/dashboard/access-control/page.tsx',
  'admin/app/[lang]/dashboard/cohorts/create/page.tsx',
  'admin/app/[lang]/dashboard/groups/create/page.tsx',
  'admin/lib/permissions.ts',

  'backend/prisma/migrations/20260321000000_subject_lessons_count/migration.sql',
  'backend/prisma/migrations/20260321102058_role_permissions/migration.sql',
  'backend/prisma/migrations/20260321102120_role_permissions/migration.sql',
  'backend/prisma/migrations/20260322000000_subject_weekly_lessons/migration.sql',

  'backend/src/controllers/admin/AdminAccessControlController.ts',
  'backend/src/controllers/admin/AdminScheduleGeneratorController.ts',
  'backend/src/controllers/admin/AdminStatsController.ts',
  'backend/src/middlewares/access-control.middleware.ts',
  'backend/src/routes/schedule.routes.ts',
  'backend/src/services/admin/AdminAccessControlService.ts',
  'backend/src/services/admin/AdminStatsService.ts',
  'backend/src/services/scheduling/ScheduleGeneratorService.ts'
)

$targetsAbs = $targetsRel | ForEach-Object { Join-Path $workspaceRoot $_ }

$cutoff = (Get-Date).AddDays(-30)
$entryFiles = Get-ChildItem -LiteralPath $historyRoot -Recurse -Filter entries.json -File -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -ge $cutoff }

$map = @{}
foreach ($ef in $entryFiles) {
  try {
    $json = Get-Content -LiteralPath $ef.FullName -Raw -ErrorAction Stop | ConvertFrom-Json
    if (-not $json.resource) { continue }

    $uri = [uri]$json.resource
    # PowerShell may return file URI paths like "/c:/Users/...".
    # Normalize to a regular Windows path ("c:\Users\...") for matching/copy.
    $path = [System.Uri]::UnescapeDataString($uri.AbsolutePath)
    $path = $path.TrimStart('/')
    $path = $path.Replace('/', '\')

    if ($path -notlike "$workspaceRoot*") { continue }
    if (-not $json.entries) { continue }

    $latest = $json.entries | Sort-Object timestamp -Descending | Select-Object -First 1
    if (-not $latest -or -not $latest.id) { continue }

    $map[$path] = [pscustomobject]@{
      historyDir = $ef.DirectoryName
      id         = $latest.id
      ts         = $latest.timestamp
    }
  } catch {
    continue
  }
}

Write-Host "Indexed workspace resources: $($map.Count)"
$probe = Join-Path $workspaceRoot 'backend\src\ai\core\AiResponder.ts'
Write-Host "Probe key present (AiResponder.ts): $($map.ContainsKey($probe))"

$restored = 0
$missing = New-Object System.Collections.Generic.List[string]

foreach ($t in $targetsAbs) {
  if ($map.ContainsKey($t)) {
    $src = Join-Path $map[$t].historyDir $map[$t].id
    if (Test-Path -LiteralPath $src) {
      $destDir = [System.IO.Path]::GetDirectoryName($t)
      New-Item -ItemType Directory -Force -Path $destDir | Out-Null
      Copy-Item -LiteralPath $src -Destination $t -Force
      $restored += 1
    } else {
      $missing.Add($t)
    }
  } else {
    $missing.Add($t)
  }
}

Write-Host "Restored: $restored / $($targetsAbs.Count)"

if ($missing.Count -gt 0) {
  Write-Host "Missing (no snapshot found): $($missing.Count)"
  $missing | Select-Object -First 50 | ForEach-Object { Write-Host "  $_" }
  if ($missing.Count -gt 50) {
    Write-Host "  ... plus $($missing.Count - 50) more"
  }
}
