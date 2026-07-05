' GameNest launcher — runs server hidden and opens browser
Dim shell, nodePath, serverPath, port
port = 3000
serverPath = CreateObject("Scripting.FileSystemObject").GetAbsolutePathName(".")
nodePath = serverPath & "\node_modules\.bin\node.cmd"
If Not CreateObject("Scripting.FileSystemObject").FileExists(nodePath) Then
    nodePath = "node"
End If

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = serverPath
shell.Run nodePath & " server.js", 0, False
WScript.Sleep 1500
shell.Run "http://localhost:" & port
