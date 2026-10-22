using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Only the circular launcher is native. All task actions remain in the extension.
internal sealed class FloatingBall : Form {
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr arg);
    delegate bool EnumProc(IntPtr hwnd, IntPtr arg);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int size);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    struct RECT { public int Left, Top, Right, Bottom; }
    static Stream output;
    static readonly object outputLock = new object();
    IntPtr panel;
    uint browserPid;
    bool collapsed, stopping, dragging;
    Point down, origin;
    string status = "展开";
    readonly System.Windows.Forms.Timer watch = new System.Windows.Forms.Timer();
    static readonly Color Green = Color.FromArgb(23,78,60);

    FloatingBall(uint parentPid) {
        browserPid = parentPid;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        AutoScaleMode = AutoScaleMode.None;
        MinimumSize = new Size(72,72); MaximumSize = new Size(72,72); Size = new Size(72,72);
        BackColor = Green; ForeColor = Color.White;
        TopMost = true; ShowInTaskbar = false; DoubleBuffered = true;
        Text = "院内流程助手 · 桌面悬浮球";
        using (var path = new GraphicsPath()) { path.AddEllipse(0,0,72,72); Region = new Region(path); }
        var menu = new ContextMenuStrip();
        menu.Items.Add("展开流程助手", null, (s,e) => ExpandPanel());
        menu.Items.Add("退出悬浮球", null, (s,e) => Close());
        ContextMenuStrip = menu;
        MouseDown += (s,e) => { if(e.Button != MouseButtons.Left) return; down = Cursor.Position; origin = Location; dragging = false; Capture = true; };
        MouseMove += (s,e) => {
            if(!Capture) return;
            int dx = Cursor.Position.X-down.X, dy = Cursor.Position.Y-down.Y;
            if(Math.Abs(dx)+Math.Abs(dy)>4) dragging = true;
            if(dragging) Location = new Point(origin.X+dx, origin.Y+dy);
        };
        MouseUp += (s,e) => { if(e.Button != MouseButtons.Left || !Capture) return; Capture=false; ClampBall(); if(!dragging) ExpandPanel(); };
        watch.Interval = 300;
        watch.Tick += (s,e) => {
            if(panel != IntPtr.Zero && !IsWindow(panel)) { panel=IntPtr.Zero; Close(); }
            else if(collapsed && panel != IntPtr.Zero && IsWindowVisible(panel)) ShowWindow(panel,0);
        };
        watch.Start();
    }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using(var pen = new Pen(Color.FromArgb(207,229,215),2)) e.Graphics.DrawEllipse(pen,1,1,69,69);
        using(var brush = new SolidBrush(Color.White)) {
            e.Graphics.FillRectangle(brush,32,13,8,26); e.Graphics.FillRectangle(brush,23,22,26,8);
        }
        using(var font = new Font("Microsoft YaHei",9)) TextRenderer.DrawText(e.Graphics,status,font,new Rectangle(2,44,68,20),Color.White,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.EndEllipsis);
    }
    void ClampBall() {
        var area = Screen.FromPoint(Location).WorkingArea;
        Location = new Point(Math.Max(area.Left,Math.Min(Left,area.Right-Width)),Math.Max(area.Top,Math.Min(Top,area.Bottom-Height)));
    }
    bool FindPanel(string title) {
        IntPtr match=IntPtr.Zero; int matches=0;
        EnumWindows((hwnd,arg) => {
            uint pid; GetWindowThreadProcessId(hwnd,out pid);
            var text=new StringBuilder(1024); GetWindowText(hwnd,text,text.Capacity);
            if(browserPid==0 || pid!=browserPid || (GetWindowLong(hwnd,-20)&8)==0 || !IsWindowVisible(hwnd)) return true;
            if(text.ToString()==title) { match=hwnd; matches++; }
            return true;
        },IntPtr.Zero);
        if(matches!=1) return false;
        panel=match;
        RECT rect; GetWindowRect(panel,out rect);
        Location=new Point(rect.Right-Width-12,rect.Bottom-Height-12); ClampBall();
        return true;
    }
    void CollapsePanel() {
        if(panel==IntPtr.Zero || !IsWindow(panel)) return;
        collapsed=true; ShowWindow(panel,0); Show(); TopMost=true;
        Send(new { type="mode", collapsed=true, panelVisible=IsWindowVisible(panel), ballVisible=Visible, width=Width, height=Height, border=FormBorderStyle.ToString(), cornerVisible=Region.IsVisible(0,0), topMost=TopMost });
    }
    void ExpandPanel() {
        if(panel==IntPtr.Zero || !IsWindow(panel)) return;
        RECT rect; GetWindowRect(panel,out rect);
        var area=Screen.FromPoint(Location).WorkingArea;
        int width=Math.Min(rect.Right-rect.Left,area.Width), height=Math.Min(rect.Bottom-rect.Top,area.Height);
        int x=Math.Max(area.Left,Math.Min(Right-width,area.Right-width));
        int y=Math.Max(area.Top,Math.Min(Bottom-height,area.Bottom-height));
        collapsed=false; Hide();
        SetWindowPos(panel,new IntPtr(-1),x,y,width,height,0x0040);
        ShowWindow(panel,5); SetForegroundWindow(panel);
        Send(new { type="mode", collapsed=false, panelVisible=IsWindowVisible(panel), ballVisible=Visible });
    }
    void HandleMessage(Dictionary<string,object> message) {
        string type=message.ContainsKey("type") ? Convert.ToString(message["type"]) : "";
        if(type=="attach") {
            // A constant title plus the browser process passed by Chrome prevents targeting unrelated windows.
            if(!FindPanel("流程助手 · 置顶悬浮窗控制页")) { Send(new {type="error",error="没有找到唯一的流程助手置顶窗口，请关闭其他助手窗口后重试。"}); return; }
            Send(new {type="ready",width=Width,height=Height}); CollapsePanel();
        } else if(type=="collapse") CollapsePanel();
        else if(type=="expand") ExpandPanel();
        else if(type=="status") { status=Convert.ToString(message.ContainsKey("text")?message["text"]:"展开"); if(status.Length>12) status=status.Substring(0,12); Invalidate(); }
        else if(type=="close") Close();
    }
    protected override void OnFormClosed(FormClosedEventArgs e) {
        stopping=true; watch.Stop();
        // A host crash/exit must not leave a hidden browser panel behind.
        if(panel!=IntPtr.Zero && IsWindow(panel)) ShowWindow(panel,5);
        base.OnFormClosed(e);
    }
    static void Send(object value) {
        var data=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(value));
        lock(outputLock) { try { output.Write(BitConverter.GetBytes(data.Length),0,4); output.Write(data,0,data.Length); output.Flush(); } catch(IOException) { } }
    }
    static byte[] ReadExact(Stream stream,int count) {
        var data=new byte[count]; int read=0;
        while(read<count) { int n=stream.Read(data,read,count-read); if(n==0) return null; read+=n; }
        return data;
    }
    [STAThread] static int Main(string[] args) {
        SetProcessDPIAware(); Application.EnableVisualStyles();
        if(args.Length==1 && args[0]=="--self-test") return SelfTest();
        uint parentPid=0;
        foreach(string arg in args) if(arg.StartsWith("--parent-window=")) {
            long handle; if(long.TryParse(arg.Substring(16),out handle)) GetWindowThreadProcessId(new IntPtr(handle),out parentPid);
        }
        if(parentPid==0) return 2;
        var input=Console.OpenStandardInput(); output=Console.OpenStandardOutput();
        var form=new FloatingBall(parentPid); form.CreateControl(); var unused=form.Handle;
        var thread=new Thread(() => {
            try {
                while(true) {
                    var header=ReadExact(input,4); if(header==null) break;
                    int count=BitConverter.ToInt32(header,0); if(count<=0 || count>16384) break;
                    var data=ReadExact(input,count); if(data==null) break;
                    var message=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(data));
                    form.BeginInvoke(new Action(() => form.HandleMessage(message)));
                }
            } catch { }
            finally { if(!form.stopping) try { form.BeginInvoke(new Action(() => form.Close())); } catch { } }
        }); thread.IsBackground=true;
        form.Shown += (s,e) => { form.Hide(); thread.Start(); };
        Application.Run(form); return 0;
    }
    static int SelfTest() {
        output=new MemoryStream();
        using(var panelForm=new Form()) using(var ball=new FloatingBall(0)) {
            panelForm.TopMost=true; panelForm.Show(); ball.panel=panelForm.Handle;
            ball.Show(); ball.CollapsePanel(); Application.DoEvents();
            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"self-test.json"),new JavaScriptSerializer().Serialize(new { width=ball.Width,height=ball.Height,corner=ball.Region.IsVisible(0,0),center=ball.Region.IsVisible(36,36),topMost=ball.TopMost,border=ball.FormBorderStyle.ToString() }));
            if(IsWindowVisible(panelForm.Handle) || !ball.Visible || ball.FormBorderStyle!=FormBorderStyle.None || !ball.TopMost) return 10;
            if(ball.Region.IsVisible(0,0) || !ball.Region.IsVisible(36,36) || ball.Size!=new Size(72,72)) return 11;
            ball.ExpandPanel(); Application.DoEvents();
            if(!IsWindowVisible(panelForm.Handle) || ball.Visible) return 12;
            ball.CollapsePanel(); ball.Close(); Application.DoEvents();
            if(!IsWindowVisible(panelForm.Handle)) return 13;
        }
        return 0;
    }
}
