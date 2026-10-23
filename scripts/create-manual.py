"""Build the Korean manual; render every page for visual review.

Local dependencies: pip install --target .tools/pdf reportlab pypdf pymupdf
Usage: python scripts/create-manual.py
"""
from pathlib import Path
import sys
import math
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools/pdf"))
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    Image, Flowable, KeepTogether,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage, ImageDraw
import pymupdf
from pypdf import PdfReader

OUT = ROOT / "output/pdf/MathCanvas-0.3-사용설명서.pdf"
TMP = ROOT / "tmp/pdfs"
OUT.parent.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Korean", "C:/Windows/Fonts/malgun.ttf"))
pdfmetrics.registerFont(TTFont("KoreanBold", "C:/Windows/Fonts/malgunbd.ttf"))
pdfmetrics.registerFontFamily("Korean", normal="Korean", bold="KoreanBold")
BLUE = colors.HexColor("#255ad7")
INK = colors.HexColor("#172e4b")
MUTED = colors.HexColor("#53677e")
PALE = colors.HexColor("#eef4ff")
LINE = colors.HexColor("#dbe4ef")
WIDTH = A4[0] - 96
styles = {
    "body": ParagraphStyle("body", fontName="Korean", fontSize=10.2, leading=16.6,
                           textColor=INK, wordWrap="CJK", spaceAfter=9),
    "small": ParagraphStyle("small", fontName="Korean", fontSize=8.6, leading=13,
                            textColor=MUTED, wordWrap="CJK", spaceAfter=7),
    "h1": ParagraphStyle("h1", fontName="KoreanBold", fontSize=23, leading=32,
                         textColor=INK, spaceAfter=17, wordWrap="CJK"),
    "h2": ParagraphStyle("h2", fontName="KoreanBold", fontSize=12.5, leading=19,
                         textColor=BLUE, spaceBefore=10, spaceAfter=8),
    "kicker": ParagraphStyle("kicker", fontName="KoreanBold", fontSize=9, leading=14,
                             textColor=BLUE, spaceAfter=9),
    "cell": ParagraphStyle("cell", fontName="Korean", fontSize=9.1, leading=14,
                           wordWrap="CJK", textColor=INK),
    "th": ParagraphStyle("th", fontName="KoreanBold", fontSize=9.1, leading=14,
                         wordWrap="CJK", textColor=colors.white),
    "formula": ParagraphStyle("formula", fontName="Korean", fontSize=13.5, leading=24,
                              textColor=BLUE, alignment=TA_CENTER, spaceAfter=12),
}


def p(text, style="body"):
    return Paragraph(text.replace("⌘", "Cmd"), styles[style])


def plain(text, style="body"):
    return p(escape(text), style)


def h(text):
    return plain(text, "h2")


def step(n, title, text):
    return p(f'<font color="#255ad7"><b>{n:02d}</b></font>  <b>{title}</b><br/>{text}')


def box(title, text):
    table = Table([[p(f"<b>{title}</b><br/>{text}")]], colWidths=[WIDTH])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), .6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def table(headers, rows, fractions):
    data = [[plain(c, "th") for c in headers]]
    data += [[plain(str(c), "cell") for c in row] for row in rows]
    result = Table(data, colWidths=[WIDTH * f for f in fractions], repeatRows=1, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f8fc")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, -1), (-1, -1), .5, LINE),
    ]))
    return result


def shot(name, max_height=245, crop=None):
    source = ROOT / "artifacts" / name
    img = PILImage.open(source).convert("RGB")
    if crop:
        img = img.crop(crop)
    target = TMP / (source.stem + ("-crop" if crop else "") + ".png")
    img.save(target)
    scale = min(WIDTH / img.width, max_height / img.height)
    return Image(str(target), img.width * scale, img.height * scale)


class AreaArt(Flowable):
    def __init__(self):
        super().__init__()
        self.width = WIDTH
        self.height = 235

    def draw(self):
        c = self.canv
        c.setFillColor(PALE)
        c.roundRect(0, 0, self.width, self.height, 12, fill=1, stroke=0)
        def xy(x, y):
            return self.width / 2 + x * 77, 76 + y * 26
        cols = ["#93b6ff", "#f4b85b", "#7ad5be"]
        for index, (lo, hi) in enumerate([(-2, -1), (-1, 1), (1, 2)]):
            path = c.beginPath()
            path.moveTo(*xy(lo, 0))
            for i in range(121):
                x = lo + (hi - lo) * i / 120
                path.lineTo(*xy(x, x**4 - 5*x*x + 4))
            path.lineTo(*xy(hi, 0))
            path.close()
            c.setFillColor(colors.HexColor(cols[index]))
            c.drawPath(path, stroke=0, fill=1)
        c.setStrokeColor(colors.HexColor("#9bacbf"))
        c.setLineWidth(.8)
        c.line(*xy(-2.8, 0), *xy(2.8, 0))
        c.line(*xy(0, -2.5), *xy(0, 5.5))
        c.setStrokeColor(INK)
        c.setLineWidth(2)
        path = c.beginPath()
        for i in range(401):
            x = -2.18 + 4.36*i/400
            q = xy(x, x**4 - 5*x*x + 4)
            (path.moveTo if i == 0 else path.lineTo)(*q)
        c.drawPath(path)
        c.setFont("KoreanBold", 11)
        c.setFillColor(INK)
        c.drawCentredString(*xy(-1.55, -1.15), "A1")
        c.drawCentredString(*xy(.4, 2.3), "A2")
        c.drawCentredString(*xy(1.55, -1.15), "A3")


story = []
titles = []


def page(title, content, kicker="사용 설명서"):
    if story:
        story.append(PageBreak())
    titles.append(title)
    story.extend([plain(kicker.upper(), "kicker"), plain(title, "h1"), *content])


page("MathCanvas", [
    p("대학 교양수학 수업을 위한<br/><b>그래프 · 넓이 · 미적분 · 회전체</b>", "h2"),
    Spacer(1, 16), AreaArt(), Spacer(1, 22),
    p("교점에서 교점까지, 각 영역의 넓이를 나누어 보고<br/>선택한 구간의 합계로 설명하는 수학 수업."),
    Spacer(1, 12), box("이 설명서의 구성", "앞의 2쪽은 수업 중 바로 보는 빠른 안내입니다. 뒤에는 설치, 전체 기능, 수업 예제, 계산 한계와 문제 해결을 담았습니다."),
    Spacer(1, 20), plain("버전 0.3.0  |  한국어  |  2026-10-23", "small"),
    plain("Windows x64 / Apple Silicon Mac 시험본\n기본 기능은 인터넷 연결 없이 사용할 수 있습니다.", "small"),
], "MATHCANVAS / TEACHING GUIDE")

page("빠른 안내 1 · 두 함수 사이 넓이", [
    step(1, "두 함수를 그립니다", "왼쪽 <b>함수 · 음함수</b>를 누르고 오른쪽에 <b>x^3-x</b>를 입력한 뒤 Enter를 누릅니다. 다시 함수를 추가해 <b>0</b>을 입력합니다."),
    step(2, "곡선을 선택합니다", "왼쪽 <b>영역 · 교점</b> 탭에서 곡선 A와 B를 고릅니다. 직선도 선 도구로 만들거나 <b>2*x+1</b> 같은 함수로 입력할 수 있습니다."),
    step(3, "교점 사이를 자동으로 나눕니다", "<b>교점 찾기 · 구간별 넓이 계산</b>을 누릅니다. 교점을 x 순서로 정렬한 뒤 이웃한 교점 사이의 넓이를 A1, A2, …로 보여줍니다."),
    step(4, "필요한 구간만 체크합니다", "각 행의 체크박스를 켜거나 끕니다. <b>전체 넓이 합계</b>와 <b>선택 합계</b>를 함께 확인합니다. 위쪽 함수가 바뀌어도 넓이는 양수로 더합니다."),
    step(5, "색칠하고 그림을 저장합니다", "<b>선택한 구간 색칠 · 값 표시</b>를 누릅니다. 필요하면 <b>선택 영역에 화면 맞추기</b>를 누른 뒤 위쪽 <b>PNG</b> 또는 <b>SVG</b>로 저장합니다."),
    box("이 예제의 답", "교점은 x=-1, 0, 1입니다. 두 영역은 각각 1/4, 1/4이고 전체 넓이는 1/2입니다. 하나만 체크하면 선택 합계는 1/4입니다."),
    Spacer(1, 12), plain("함수 입력은 Enter 또는 입력칸 밖 클릭으로 적용합니다. 교점이 안 보이면 탐색 x 범위를 넓혀 다시 계산하세요. 상세 사용법은 12-13쪽입니다.", "small"),
], "QUICK START / 01")

page("빠른 안내 2 · 수업 준비와 3D", [
    h("수업 자료를 준비할 때"),
    table(["할 일", "조작"], [
        ["그림 이동 / 확대", "빈 공간 드래그 / 마우스 휠 또는 아래 확대 조절바"],
        ["점·선·원 추가", "왼쪽 도구를 누른 뒤 오른쪽 속성에서 좌표와 모양 수정"],
        ["교점 좌표 표시", "영역 · 교점 → 곡선 A/B → 교점 표시"],
        ["수식 쓰기", r"수식 도구 → LaTeX 입력. 예: \frac{1}{2}, \int_0^1 x^2 dx"],
        ["편집 가능한 수업 저장", "저장 / Ctrl+S (Mac: ⌘+S) → .mathcanvas"],
        ["슬라이드용 그림", "흰 배경 또는 투명 배경 선택 → PNG / SVG"],
    ], [.32, .68]),
    h("원판법과 와셔법을 시연할 때"),
    step(1, "3D · 회전체로 전환", "입체 종류를 <b>회전체 · 부피</b>로 둡니다. 반지름 식에 <b>sqrt(4-t^2)</b>, 구간에 <b>-2, 2</b>를 입력하면 구를 볼 수 있습니다."),
    step(2, "두 경계를 회전", "<b>두 함수 사이 회전 · 와셔법</b>을 켜고 첫 식 <b>2</b>, 둘째 식 <b>1</b>, 구간 <b>0, 3</b>을 넣습니다. 부피는 9π ≈ 28.274334입니다."),
    step(3, "관찰하고 저장", "그림을 드래그하면 입체가 회전합니다. 시점 초기화로 돌아올 수 있습니다. 설정은 수업 파일에 저장하고 현재 그림은 PNG/SVG로 저장합니다."),
    box("실수했을 때", "Ctrl/⌘+Z로 실행 취소, Ctrl/⌘+Shift+Z로 다시 실행합니다. Esc는 작도를 취소합니다. 입력칸의 Delete/Backspace는 글자를 편집합니다."),
], "QUICK START / 02")

page("필요한 기능 찾기", [
    table(["쪽", "내용", "수업에서 쓰는 순간"], [
        ["2-3", "빠른 안내", "처음 실행하거나 수업 중 순서를 확인할 때"],
        ["5-6", "설치 · 화면과 이동", "Windows/Mac 준비, 좌표 범위 설정"],
        ["7-8", "함수 입력 · 각도 · 극좌표", "다항·삼각·지수·로그·음함수 그리기"],
        ["9-10", "점·선·원 · 텍스트·수식", "도형과 주석을 배치할 때"],
        ["11", "교점과 좌표", "고정/연동 교점, 좌표축과 만나는 점"],
        ["12-13", "교점 사이 넓이", "구간별 넓이, 선택 합계, 검산 예제"],
        ["14", "직접 지정 영역 · 음함수", "원 내부, 두 원 겹침, 원과 포물선"],
        ["15", "미분과 정적분", "접선, 미분계수, 부호와 넓이 비교"],
        ["16-18", "3D와 부피", "원판법, 와셔법, 곡면과 기본 입체"],
        ["19-20", "파일 저장 · 그림 내보내기", "수업 이어하기, 시험지·슬라이드 제작"],
        ["21", "단축키 · 문제 해결", "입력 오류, 그래프나 영역 누락 확인"],
        ["22", "계산 한계 · 다음 개선", "수치 결과 해석, 확장 우선순위"],
    ], [.12, .36, .52]),
    Spacer(1, 16), p("화면의 버튼 이름은 <b>굵게</b> 표시했습니다. 식은 입력칸에 넣을 문자열을 그대로 적었습니다. ‘≈’는 수치 근삿값을 뜻합니다."),
    plain("이 설명서는 MathCanvas 0.3.0 화면과 함께 작성했습니다. 별도 온라인 계정이나 GitHub 연결은 기본 사용에 필요하지 않습니다.", "small"),
], "CONTENTS")

page("설치와 첫 실행", [
    h("Windows x64"),
    p("설치형은 <b>MathCanvas-0.3.0-windows-x64-setup.exe</b>를 실행하고 설치 위치를 선택합니다. 휴대용은 <b>MathCanvas-0.3.0-windows-x64-portable.exe</b>를 실행합니다. 일반 사용에는 Node.js 설치가 필요 없습니다."),
    p("개인 시험용 파일로 개발자 인증서 서명은 없습니다. 설치형과 휴대용 모두 수업 파일의 열기·저장, 오프라인 그래프와 3D 기능을 제공합니다."),
    h("Apple Silicon Mac (M 계열)"),
    step(1, "ZIP 압축을 풉니다", "<b>MathCanvas-0.3.0-mac-arm64-unsigned.zip</b>을 Mac으로 옮겨 압축을 풉니다. Windows의 .exe 대신 ZIP 안의 Mac 앱을 사용합니다."),
    step(2, "최초 실행 스크립트를 실행합니다", "같은 폴더의 <b>Start-MathCanvas.command</b>를 실행합니다. 이 스크립트는 해당 Mac에서 ad-hoc 서명을 적용하고 검사한 뒤 MathCanvas.app을 엽니다."),
    step(3, "실행을 확인합니다", "실행에 성공하면 MathCanvas.app을 Applications로 옮깁니다. 예제 파일을 열어 그래프와 저장을 확인한 후 수업에 사용하세요."),
    box("Mac 시험본의 확인 범위", "ARM64 파일, 실행 권한, 앱 자산, 헬퍼 앱과 프레임워크 링크는 패키지 검사 대상입니다. 실제 Mac 실행과 Apple Developer ID 서명·공증은 아직 검증하지 않았습니다. 로컬 서명 실패나 학교 보안 정책으로 차단될 때는 Mac에서 원본을 빌드해야 합니다."),
    h("원본에서 Mac 빌드"),
    plain("Node.js 24 환경에서 프로젝트 폴더를 열고 npm ci, npm run dist:mac을 차례로 실행합니다. 개발과 빌드에는 의존성 다운로드가 필요할 수 있습니다. 상세 명령은 README.md에 있습니다.", "small"),
], "01 / SETUP")

page("화면 구성과 좌표 이동", [
    shot("01-desktop-empty.png", 265),
    plain("처음 실행한 2D 화면. 왼쪽은 도구와 객체 목록, 가운데는 그림, 오른쪽은 선택한 객체의 속성입니다.", "small"),
    table(["위치", "용도"], [
        ["위쪽 막대", "2D/3D 전환, 새로·열기·저장, 실행 취소, 배경, SVG/PNG"],
        ["왼쪽 객체 탭", "객체 선택, 표시/숨김, 잠금/해제"],
        ["왼쪽 영역 · 교점", "곡선 선택, 교점 표시, 자동 넓이 분할, 직접 영역 지정"],
        ["왼쪽 화면 탭", "각도 단위, x/y 범위, 눈금 간격, 격자와 축, 그림 설명"],
        ["오른쪽 속성", "수식·좌표·선·글자·채우기와 계산 기능"],
    ], [.3, .7]),
    Spacer(1, 10), p("빈 공간을 끌어 화면을 이동하고, 휠이나 아래 조절바로 확대합니다. 정확한 범위는 <b>화면</b> 탭의 x/y 최솟값·최댓값에 입력하세요. 최솟값은 최댓값보다 작아야 합니다."),
    plain("기본 보기는 x/y 모두 -10부터 10까지입니다. 원점을 가운데로는 현재 크기를 유지하며 중심을 옮깁니다. x/y의 단위 길이는 같게 유지합니다. 두 범위의 비율이 그림과 다르면 여백이 생길 수 있습니다.", "small"),
], "02 / WORKSPACE")

page("함수 입력과 문법", [
    p("<b>함수 · 음함수</b>를 눌러 객체를 만든 뒤 오른쪽 함수 수식에 입력합니다. 식은 처음에 비어 있습니다. Enter 또는 입력칸 밖 클릭으로 적용하며, 입력 도중의 미완성 괄호가 앱 전체를 중단시키지 않도록 처리합니다."),
    table(["종류", "입력 예", "뜻"], [
        ["다항함수", "x^4-5*x^2+4", "거듭제곱은 ^, 곱셈은 *"],
        ["명시적 함수", "y=x^2", "y=를 붙이거나 식만 입력"],
        ["삼각함수", "sin(x), cos(x), tan(x)", "각도 단위는 화면 탭에서 선택"],
        ["역삼각함수", "asin(x), acos(x), atan(x)", "sin^-1 대신 asin 사용"],
        ["지수함수", "exp(x), 2^x", "자연지수 / 밑이 2인 지수"],
        ["로그함수", "log(x), log10(x), log(x,2)", "자연로그 / 상용로그 / 밑 지정"],
        ["유리·무리함수", "1/x, sqrt(x), cbrt(x)", "실수로 정의되는 구간을 그림"],
        ["음함수", "x^2+y^2=4", "양쪽 식의 차이가 0인 곡선"],
        ["일반 역관계", "x=y^2", "가지가 여럿인 관계는 음함수로"],
        ["상수", "pi, e", "예: sin(pi*x), e^x"],
    ], [.22, .43, .35]),
    h("입력 오류를 줄이는 방법"),
    p("함수 입력 아래의 버튼으로 자주 쓰는 기호를 넣을 수 있습니다. 표시용 미리보기와 계산용 식은 역할이 다릅니다. 계산에는 위 표처럼 입력하고, 교재 형식의 설명은 별도 <b>수식</b> 객체에 LaTeX로 넣으세요."),
    plain("함수 수식에서 사용자 함수 정의, 프로그램 실행, 배열·복소수 계산은 지원하지 않습니다. 정의역 직접 지정을 켜면 제한할 구간을 입력할 수 있습니다.", "small"),
], "03 / EXPRESSIONS")

page("각도 단위와 극좌표", [
    h("라디안과 도"),
    p("<b>화면 → 각도 단위</b>에서 라디안(rad) 또는 도(°)를 선택합니다. 2D 함수의 삼각함수 입력, 역삼각함수의 출력, 극좌표 각도에 적용됩니다. 3D 수식도 현재 단위를 따릅니다."),
    table(["상황", "라디안", "도"], [
        ["sin 입력 검산", "sin(pi/2)=1", "sin(90)=1"],
        ["역삼각함수", "asin(1)=pi/2", "asin(1)=90"],
        ["극좌표 기본 한 바퀴", "0 ~ 2*pi", "0 ~ 360"],
        ["미분·적분 해석", "일반적인 미적분 수업의 기본값", "x가 도 단위이므로 미분계수도 달라짐"],
    ], [.3, .35, .35]),
    h("극좌표 함수 그리기"),
    step(1, "식을 입력합니다", "함수 입력에 <b>r=1+cos(theta)</b>를 넣으면 심장형 곡선을 그립니다. 변수는 theta를 권장합니다."),
    step(2, "필요한 각도 구간을 정합니다", "<b>정의역 직접 지정</b>을 켜면 각도 시작과 끝을 넣을 수 있습니다. 라디안에서 한 바퀴는 약 6.283185, 도에서는 360입니다."),
    step(3, "다른 곡선과 비교합니다", "<b>r=cos(3theta)</b>는 장미곡선 예입니다. 음수 r도 극좌표의 뜻에 따라 반대 방향으로 표시합니다."),
    box("자동 넓이 분할과의 관계", "현재 교점 사이 넓이 자동 분할은 y=f(x)와 수직이 아닌 선을 대상으로 합니다. 극좌표의 넓이 적분이나 극좌표끼리의 자동 영역 선택은 이 버전의 계산 기능에 포함하지 않습니다."),
], "04 / ANGLES & POLAR")

page("점 · 선 · 원", [
    h("점"),
    p("<b>점</b>을 누르고 오른쪽에서 x, y 좌표를 바꿉니다. 점 이름과 표시 여부, 점 크기, 채운 점 여부를 설정할 수 있습니다. 이름 위치의 기본값은 <b>위</b>이며 8방향으로 바꿀 수 있습니다."),
    h("선분 · 직선 · 반직선"),
    p("<b>선 · 화살표</b>를 누른 뒤 캔버스에서 시작점과 끝점을 클릭합니다. 오른쪽 <b>선 범주</b>에서 선분, 직선, 반직선을 고릅니다. 반직선은 첫 점에서 둘째 점 방향으로 뻗습니다. Esc로 작도를 취소합니다."),
    table(["속성", "선택 사항"], [
        ["끝점 좌표", "시작 x/y, 끝 x/y를 숫자로 수정"],
        ["화살표", "없음, 열린 화살표, 채운 화살표, 양끝 화살표"],
        ["선 모양", "색, 두께, 실선·파선·점선·이중선"],
        ["기본 색", "선과 화살표는 빨간색. 화살표 색은 선 색을 따름"],
    ], [.3, .7]),
    h("원"),
    p("<b>원</b>을 누른 뒤 중심 x/y와 반지름을 입력합니다. 기본 선은 검정색입니다. 중심점 표시와 내부 채우기를 켜거나 끌 수 있습니다. 원 도구로 만든 원도 교점과 영역 계산의 곡선으로 선택할 수 있습니다."),
    box("목록에서 관리하기", "객체 이름을 눌러 속성을 엽니다. 눈 모양 버튼은 표시/숨김, 자물쇠는 이동·삭제 잠금입니다. 선택한 객체는 Delete/Backspace 또는 속성 아래 삭제 버튼으로 지웁니다. 입력칸을 편집할 때는 글자만 지웁니다."),
    Spacer(1, 10), plain("좌표 확인 도구는 그림 위를 클릭한 위치의 좌표를 보여줍니다. 점·텍스트·수식 등의 위치는 드래그하거나 오른쪽 숫자로 조절할 수 있습니다.", "small"),
], "05 / GEOMETRY")

page("텍스트 · 수식 · 스타일", [
    h("설명용 텍스트"),
    p("<b>텍스트</b> 도구는 그래프 옆에 짧은 설명을 적을 때 사용합니다. 내용과 x/y 위치, 글자 크기, 글자 색을 오른쪽 속성에서 바꿉니다."),
    h("LaTeX 수식"),
    p("<b>수식</b> 도구를 누르고 LaTeX 수식을 입력합니다. 입력 버튼과 키보드를 함께 사용할 수 있습니다. 미리보기를 확인하고 Enter로 적용하세요."),
    table(["표현", "입력"], [
        ["분수", r"\frac{a}{b}"],
        ["지수와 아래첨자", r"x^2, x_i, x^{n+1}"],
        ["제곱근", r"\sqrt{x}, \sqrt[3]{x}"],
        ["정적분", r"\int_{-1}^{1} (1-x^2)\,dx"],
        ["극한", r"\lim_{x\to 0}\frac{\sin x}{x}=1"],
        ["그리스 문자", r"\alpha, \theta, \pi"],
    ], [.32, .68]),
    h("공통 스타일과 그림 설명"),
    p("글자 크기와 선 두께의 조절바 앞에는 현재 숫자가 표시됩니다. 함수·선·원은 선 색과 종류를 바꿀 수 있습니다. 영역은 채우기 색, 불투명도, 이름과 이름 위치를 조절할 수 있습니다."),
    p("그림 아래 설명은 <b>화면 → 그림 설명</b>에서 입력합니다. 설명 글자 크기와 색도 바꿀 수 있으며 그림 내보내기에 포함됩니다."),
    box("다른 PC에서도 수식 모양 유지", "PNG는 전체 그림을 이미지로 저장합니다. SVG에는 그래프를 벡터로, LaTeX 글리프와 축 수식은 투명 이미지로 포함합니다. 별도 KaTeX 글꼴 설치 없이 수식 모양을 유지하지만 수식 부분 자체는 벡터가 아닙니다."),
], "06 / ANNOTATIONS")

page("교점과 좌표 표시", [
    step(1, "곡선 A와 B를 고릅니다", "<b>영역 · 교점</b> 탭의 목록에서 함수·선·원 또는 x축/y축을 고릅니다. 서로 다른 두 대상을 선택하세요."),
    step(2, "현재 화면 범위를 확인합니다", "일반 <b>교점 표시</b>는 현재 x/y 화면 범위에서 교점을 찾습니다. 보이지 않는 교점이 필요하면 먼저 화면 범위를 넓힙니다."),
    step(3, "고정 또는 연동으로 만듭니다", "<b>함수 변경 시 교점도 갱신</b>을 켜고 교점 표시를 누르면 연동 교점이 됩니다. 끈 상태에서 생성하면 현재 좌표에 고정된 점이 됩니다."),
    h("축과 만나는 점을 빠르게 표시"),
    p("함수를 선택한 오른쪽 속성에는 <b>x축 교점 표시</b>, <b>y축 교점 표시</b> 체크박스가 있습니다. 교점 좌표와 점 이름의 위치는 점 속성에서 설정할 수 있습니다."),
    h("연동 교점을 고정하기"),
    p("연동된 점을 선택한 뒤 <b>현재 좌표에 고정</b>을 누릅니다. 이후 함수가 변해도 그 점은 기존 위치에 남습니다. 수업에서 변화 전후를 비교할 때 사용할 수 있습니다."),
    box("교점 개수가 바뀌는 경우", "연동 교점은 x/y 정렬 순서로 연결합니다. 함수 변화로 교점이 생기거나 사라지면 순서가 달라질 수 있습니다. 새 교점까지 표시하려면 다시 교점 표시를 누르세요. 접점과 매우 가까운 교점은 수치 해상도의 영향을 받습니다."),
    Spacer(1, 12), plain("교점이 연속적으로 무한히 많은 일치 곡선은 고립 교점 목록으로 만들지 않습니다. 수치적 특이점이나 불연속점은 실제 교점과 구분하여 해석해야 합니다.", "small"),
], "07 / INTERSECTIONS")

page("교점 사이 넓이 자동 분할", [
    p("두 그래프가 여러 번 만나는 경우, 위쪽 곡선을 직접 바꾸며 구간을 만들 필요가 없습니다. <b>교점 사이 넓이 · 자동 분할</b>에서 이웃한 교점 사이를 각각 계산합니다."),
    step(1, "함수 또는 선을 선택", "곡선 A/B를 선택합니다. y=f(x) 형태의 일반 함수와 수직이 아닌 선을 지원합니다. 다항함수, 삼각함수, 지수·로그 등도 같은 방식으로 사용합니다."),
    step(2, "탐색할 x 범위를 지정", "기본은 현재 화면의 x 범위입니다. 체크를 끄면 <b>교점 탐색 시작/끝</b>을 직접 지정할 수 있습니다. 이 기능은 y가 화면 밖인 교점도 탐색할 수 있습니다."),
    step(3, "구간별 값과 선택 합계 확인", "계산 버튼을 누르면 A1, A2, …의 x 구간, 넓이, 위쪽 곡선을 보여줍니다. 원하는 행만 체크하면 선택 합계가 갱신됩니다."),
    step(4, "선택 구간 색칠", "<b>선택한 구간 색칠 · 값 표시</b>를 누릅니다. 같은 두 곡선으로 만든 이전 자동 영역은 새 선택으로 교체됩니다. 수동으로 만든 영역은 유지합니다."),
    step(5, "화면 맞춤과 갱신", "<b>선택 영역에 화면 맞추기</b>로 그림을 맞춥니다. 생성된 자동 영역은 교점 순서를 따라 경계와 값이 갱신됩니다. 교점 개수가 달라지면 분할을 다시 실행하세요."),
    box("고정 구간으로 바꾸기", "생성된 영역을 선택하고 오른쪽 <b>현재 구간에 고정</b>을 누르면 현재 x 경계를 고정합니다. 이후 직접 경계를 편집할 수 있습니다. 함수가 바뀌면 고정 구간에서의 그림은 달라집니다."),
    Spacer(1, 10), plain("첫 교점 이전과 마지막 교점 이후는 포함하지 않습니다. 교점이 0개 또는 1개이면 두 곡선만으로 닫힌 구간을 만들 수 없습니다. 극점·정의역 구멍·수렴 실패 구간은 계산 불가로 표시합니다.", "small"),
], "08 / AUTOMATIC AREAS")

page("넓이 수업 예제와 검산", [
    shot("auto-area.png", 245),
    plain("사차함수 f(x)=x⁴-5x²+4와 g(x)=0. 구간마다 위쪽 곡선이 바뀌지만 세 넓이는 모두 양수입니다.", "small"),
    table(["예제 / 탐색 범위", "교점 x", "각 영역 / 전체 넓이"], [
        ["x^3-x 와 0 / [-2,2]", "-1, 0, 1", "1/4, 1/4 / 합계 1/2"],
        ["x^4-5x^2+4 와 0 / [-3,3]", "-2, -1, 1, 2", "22/15, 76/15, 22/15 / 합계 8"],
        ["sin(x) 와 0 / [-7,7], rad", "-2π, -π, 0, π, 2π", "2, 2, 2, 2 / 합계 8"],
    ], [.4, .24, .36]),
    h("선택 합계로 질문 만들기"),
    p("사차함수 예에서 A2 체크를 끄면 양쪽 영역만 남습니다. 선택 합계는 <b>44/15 ≈ 2.933333</b>입니다. 학생에게 부호 있는 적분과 넓이 합계가 왜 다른지 설명하게 해보세요."),
    plain("examples 폴더의 05·06 예제를 열면 자동 영역이 포함된 그림을 확인할 수 있습니다. 구간별 체크 목록은 영역 · 교점에서 두 함수를 선택하고 다시 계산하여 엽니다.", "small"),
], "09 / CLASSROOM EXAMPLES")

page("직접 지정 영역과 음함수", [
    p("<b>영역 채우기 · 직접 지정</b>은 지정한 x 구간의 가지 사이, 한 곡선의 내부, 두 내부 조건의 교집합을 칠합니다. 영역을 만든 뒤 오른쪽 <b>넓이 계산</b>을 누릅니다."),
    table(["원하는 영역", "곡선과 설정"], [
        ["원 내부 전체", "A: x^2+y^2=4 / A의 내부 조건 / ≤0 / x=-2~2"],
        ["원과 x축 사이 위 반원", "A: x^2+y^2=4, B: y=0 / 가지 사이 / A 위쪽, B 위쪽 / x=-2~2"],
        ["원 내부이면서 포물선 위", "A: x^2+y^2=4, B: y=x^2-1 / 교집합 / A ≤0, B ≥0 / x=-2~2"],
        ["두 원의 공통 내부", "A: x^2+y^2=4, B: (x-2)^2+y^2=4 / 교집합 / 둘 다 ≤0 / x=0~2"],
    ], [.31, .69]),
    h("≤0 / ≥0 조건의 뜻"),
    p("음함수 F=G의 조건은 <b>F-G</b>의 부호입니다. 원 x²+y²=4의 내부는 x²+y²-4≤0입니다. y=f(x)는 <b>y-f(x)</b>로 해석하므로 ≥0은 그래프 위쪽, ≤0은 아래쪽입니다."),
    h("가지 선택의 뜻"),
    p("같은 x에서 y가 두 개 이상이면 위쪽 또는 아래쪽 가지를 선택합니다. 원에서는 각각 위 반원, 아래 반원에 해당합니다. 복잡한 여러 가지를 임의로 클릭해 고르는 방식은 아직 지원하지 않습니다."),
    box("음함수 영역이 잘리는 경우", "음함수의 채우기와 넓이는 현재 y 화면 범위 안에서 계산합니다. 원 전체를 구하려면 위아래가 모두 보이게 범위를 설정하세요. 격자보다 얇은 부분이나 부호 변화가 없는 중근 형태는 누락될 수 있습니다."),
], "10 / IMPLICIT REGIONS")

page("접선 · 미분계수 · 정적분", [
    h("접선과 미분계수"),
    step(1, "일반 함수를 선택", "예를 들어 <b>x^2</b>를 그린 뒤 오른쪽의 <b>미분 · 정적분</b>을 찾습니다. 이 계산 패널은 y=f(x) 형태의 일반 함수에 나타납니다."),
    step(2, "접점을 지정", "접점의 x 좌표에 <b>1</b>을 입력하고 <b>접선 · 미분계수 표시</b>를 누릅니다. 기울기는 약 2이고, 점 (1,1)을 지나는 접선을 추가합니다."),
    p("추가된 접선은 일반 직선 객체입니다. 원래 함수를 변경해도 자동 접선으로 계속 추적하지 않습니다. 필요할 때 새 접선을 생성하거나 기존 직선을 삭제하세요."),
    h("정적분과 기하학적 넓이"),
    p("적분 시작과 끝을 입력하고 <b>정적분 · 넓이 계산</b>을 누릅니다. 정적분은 부호를 포함하고, 넓이는 절댓값을 적분합니다. <b>적분 구간 색칠</b>은 함수와 x축 사이를 칠합니다."),
    table(["예제", "정적분", "넓이"], [
        ["f(x)=x, [-1,1]", "0", "1"],
        ["f(x)=x^2, [0,1]", "1/3", "1/3"],
        ["f(x)=sin(x), [0,2π], rad", "0", "4"],
    ], [.46, .27, .27]),
    Spacer(1, 12), box("미정의·발산·미분 불가능", "수치 미분·적분의 근삿값입니다. 극점이 포함되거나 수렴을 확인하지 못하면 값을 표시하지 않습니다. 모든 이상적분이나 비매끄러운 점의 미분 가능성을 판정하는 도구는 아닙니다."),
], "11 / CALCULUS")

page("원판법으로 회전체와 부피 보기", [
    p("위쪽 <b>3D · 회전체</b>로 전환합니다. 입체 종류는 <b>회전체 · 부피</b>를 고르고 <b>두 함수 사이 회전 · 와셔법</b>은 끕니다."),
    shot("03-revolution.png", 255, (0, 76, 1123, 865)),
    step(1, "반지름 함수를 입력", "반지름 r=f(t) 입력에는 <b>sqrt(4-t^2)</b>처럼 식만 넣습니다. t는 회전축 위의 좌표이며 반지름은 |f(t)|입니다."),
    step(2, "구간과 회전축 지정", "구간 시작 <b>-2</b>, 끝 <b>2</b>, 회전축 <b>x축</b>을 선택합니다. 반원을 회전한 반지름 2인 구가 됩니다."),
    p("부피는 <b>V=π∫[f(t)]²dt</b>로 계산합니다. 이 예의 부피는 32π/3 ≈ 33.510322입니다. x축을 고르면 x=t, y축을 고르면 y=t로 해석합니다."),
    plain("수업 예제의 반원 → 구, 직선 → 원뿔, 삼각함수 회전체 버튼으로 빠르게 전환할 수 있습니다. 회전축 선택은 두 좌표축에 한합니다.", "small"),
], "12 / DISK METHOD")

page("와셔법으로 두 경계 사이 회전", [
    step(1, "와셔법 켜기", "회전체에서 <b>두 함수 사이 회전 · 와셔법</b>을 켭니다. 두 번째 경계 g(t) 입력칸이 나타납니다."),
    step(2, "두 경계와 구간 입력", "첫 식은 <b>2</b>, 둘째 식은 <b>1</b>, 구간은 <b>0~3</b>으로 둡니다. 가운데가 빈 원기둥 모양을 확인할 수 있습니다."),
    shot("03b-washer.png", 245, (0, 76, 1123, 865)),
    p("같은 쪽에 있는 두 경계는 절댓값이 큰 쪽이 바깥 반지름 R, 작은 쪽이 안쪽 반지름 r입니다. 두 함수의 위아래가 바뀌어도 이 규칙으로 계산합니다."),
    p("<b>V=π∫(R²-r²)dt</b><br/>예제: π(2²-1²)×3 = <b>9π ≈ 28.274334</b>"),
    box("두 경계가 축의 양쪽에 있을 때", "경계 사이의 선분이 회전축을 지나면 안쪽 반지름은 0입니다. 예를 들어 -1과 2 사이는 구멍이 있는 와셔가 아니라 반지름 2인 원판을 만듭니다."),
], "13 / WASHER METHOD")

page("곡면과 기본 입체", [
    table(["입체 종류", "설정", "수업에서의 활용"], [
        ["곡면 z=f(x,y)", "sin(x)*cos(y), x^2+y^2 등. 구간은 x/y에 공통 적용", "이변수 함수의 높이와 곡면 모양"],
        ["구", "반지름", "구의 표면과 부피 4πr³/3"],
        ["원뿔", "반지름, 구간 시작/끝으로 높이 지정", "부피 πr²h/3, 회전체와 비교"],
        ["도넛 (원환면)", "관 반지름 r, 중심 원 반지름 R", "부피 2π²Rr². R은 r보다 크게"],
    ], [.24, .43, .33]),
    h("시점과 확대"),
    p("그림 안을 드래그하여 입체를 회전합니다. 휠로 확대·축소하고 <b>시점 초기화</b>로 돌아옵니다. 3D는 직교 투영과 유한한 격자 면으로 그리므로 표면에 다각형 경계가 보일 수 있습니다."),
    h("부피 표시"),
    p("구·원뿔·원환면과 회전체에는 부피를 표시합니다. 일반 곡면 z=f(x,y)의 보기에는 입체의 바닥이나 옆면을 정의하지 않으므로 부피를 표시하지 않습니다."),
    h("2D와 함께 저장하기"),
    p("2D 객체와 3D 함수·입체 종류·구간·반지름 설정은 같은 .mathcanvas 수업 파일에 들어갑니다. 화면을 바꾸어도 2D 객체가 삭제되지 않습니다. 다만 3D 카메라의 회전·확대 상태는 파일에 저장하지 않습니다."),
    box("지원 범위", "임의의 3D 음함수 F(x,y,z)=0, 다변수 적분, 평행 이동한 임의 직선에 대한 회전, 2D 음함수 영역 전체의 회전은 이 버전에 포함하지 않습니다. 회전체에는 축 좌표 t에 따른 경계를 입력하세요."),
], "14 / SPATIAL VIEW")

page("수업 파일 저장과 복구", [
    step(1, "작업을 파일로 저장", "위쪽 <b>저장</b> 또는 Ctrl/⌘+S를 누릅니다. .mathcanvas 파일 이름과 위치를 고릅니다. 입력하던 수식도 적용한 뒤 저장합니다."),
    step(2, "다시 열기", "<b>열기</b> 또는 Ctrl/⌘+O로 파일을 선택합니다. 파일을 더블 클릭해 앱을 연결하는 기능은 별도 설정하지 않았으므로 앱의 열기 버튼을 사용하세요."),
    step(3, "다른 기기로 이동", ".mathcanvas 파일을 USB나 공유 폴더로 옮겨 다른 MathCanvas에서 엽니다. PNG/SVG만으로는 함수나 객체를 다시 편집할 수 없습니다."),
    h("자동 복구"),
    p("작업은 현재 기기의 로컬 사용자 프로필에 자동 저장됩니다. 앱을 다시 실행하면 마지막 작업을 복구합니다. 자동 복구는 실수에 대비한 보조 기능이므로 수업 자료는 별도 파일로 저장하세요."),
    p("휴대용 실행 파일도 복구 자료는 사용자 프로필에 저장합니다. 실행 파일만 USB로 옮기면 마지막 수업이 함께 이동하지 않습니다. .mathcanvas 파일도 같이 가져가세요."),
    h("새 수업과 이전 형식"),
    p("<b>새로</b>를 누르면 새 수업으로 초기화할지 확인합니다. 현재 작업을 보관하려면 먼저 저장하세요. 기존 형식의 JSON 수업 파일도 구조가 유효하면 열 수 있습니다."),
    box("예제 파일", "examples 폴더의 01 두 포물선, 02 두 원 겹침, 03 극좌표 심장형, 04 와셔법, 05 사차함수 자동 영역, 06 삼각함수 자동 영역을 열어 연습할 수 있습니다. 예제를 수정한 뒤 새 이름으로 저장하면 원본을 보관할 수 있습니다."),
], "15 / PROJECT FILES")

page("PNG · SVG로 그림 내보내기", [
    step(1, "그림을 완성", "축 범위, 눈금, 함수 색, 영역, 수식과 설명을 확인합니다. 현재 보이는 2D 또는 3D 그림이 저장됩니다."),
    step(2, "배경 선택", "위쪽 배경 목록에서 <b>흰 배경</b> 또는 <b>투명 배경</b>을 선택합니다. 슬라이드 배경 위에 올릴 때는 투명을 사용할 수 있습니다."),
    step(3, "형식 선택", "<b>PNG</b> 또는 <b>SVG</b>를 누르고 저장 위치를 정합니다. 편집용 선택 테두리와 조절점은 출력에서 제외합니다."),
    table(["형식", "추천 용도", "특징"], [
        ["PNG", "슬라이드, 한글/Word, 메신저", "이미지로 완결. 프로그램 사이 호환성이 좋음"],
        ["SVG", "크기를 바꾸는 도형·그래프 자료", "그래프·선은 벡터. LaTeX는 포함된 이미지"],
        [".mathcanvas", "수식·좌표·스타일 재편집", "앱에서 다시 여는 수업 데이터"],
    ], [.2, .39, .41]),
    h("수식이 깨지지 않는 출력"),
    p("화면의 LaTeX와 축 수식을 그림에 포함하므로 대상 PC의 KaTeX 설치에 의존하지 않습니다. SVG 수식은 고해상도 투명 이미지이며, 무한 확대 시 벡터 수식처럼 선명도가 유지되는 방식은 아닙니다."),
    h("PDF가 필요한 경우"),
    p("앱의 직접 내보내기는 PNG와 SVG입니다. 수업용 PDF는 문서나 프레젠테이션에 그림을 넣은 뒤 해당 프로그램에서 PDF로 저장하세요. 이 사용 설명서는 별도로 제공하는 PDF입니다."),
    box("투명 배경 확인", "투명 PNG는 보기 프로그램에서 검정·체크무늬·흰색으로 보일 수 있습니다. 밝은 슬라이드와 어두운 슬라이드에 각각 넣어 글자와 선의 대비를 확인하세요."),
], "16 / EXPORT")

page("단축키와 문제 해결", [
    table(["기능", "Windows", "Mac"], [
        ["저장 / 열기", "Ctrl+S / Ctrl+O", "⌘+S / ⌘+O"],
        ["실행 취소", "Ctrl+Z", "⌘+Z"],
        ["다시 실행", "Ctrl+Shift+Z 또는 Ctrl+Y", "⌘+Shift+Z"],
        ["객체 삭제 / 작도 취소", "Delete 또는 Backspace / Esc", "Delete 또는 Backspace / Esc"],
        ["수식 적용", "Enter 또는 입력칸 밖 클릭", "Enter 또는 입력칸 밖 클릭"],
    ], [.36, .32, .32]),
    Spacer(1, 14), table(["증상", "먼저 확인할 것"], [
        ["함수가 안 보임", "식 오류 문구, x/y 범위, 정의역, 숨김 여부를 확인. log·sqrt의 실수 정의역 확인"],
        ["삼각함수 주기가 예상과 다름", "라디안/도 선택 확인. 단위를 바꾼 뒤 구간 숫자도 확인"],
        ["교점이나 자동 영역이 적음", "탐색 범위를 넓히거나 좁혀 재계산. 곡선이 일치하거나 접할 때 주의"],
        ["넓이가 계산 불가", "정의역 구멍·극점·수렴 실패 확인. 1/x의 0을 가로지르는 구간 주의"],
        ["음함수 영역이 잘림", "y 범위를 넓히고 조건의 ≤0/≥0과 가지 선택을 확인"],
        ["수식 오류", "괄호와 중괄호 확인. 계산용 식과 LaTeX 표시용 식을 구분"],
        ["Mac 실행 실패", "ZIP 압축 해제, 최초 실행 스크립트 결과 확인. 실패 시 Mac에서 소스 빌드 필요"],
    ], [.32, .68]),
    Spacer(1, 12), plain("오류 보고에는 입력한 두 식, 각도 단위, x/y 범위, 누른 버튼 순서, 가능하면 .mathcanvas 파일을 함께 남기면 재현에 도움이 됩니다.", "small"),
], "17 / HELP")

page("계산의 한계와 다음 개선", [
    h("수치 시각화 도구로 사용하기"),
    p("교점·넓이·미분·적분·회전체 부피는 수치 근사입니다. 임의의 식을 정확하게 푸는 기호 연산기나 모든 수학적 성질을 판정하는 도구는 아닙니다. 중요한 수업 값은 알려진 해석 결과와 비교하세요."),
    table(["영역", "주의할 점"], [
        ["교점 탐색", "아주 가까운 근, 고주파 진동, 접점, 작은 연결 성분을 놓칠 수 있음"],
        ["자동 영역", "이웃한 탐색 교점 사이만 포함. 교점 수 변화 후 재분할 필요. 수직선·극좌표·음함수 자동 분할 제외"],
        ["음함수", "유한 격자와 현재 y 범위 영향. (x²+y²-4)²=0 대신 x²+y²=4 권장"],
        ["미분·적분", "유한 구간의 수치 계산. 모든 이상적분·미분 불가능점 판정은 제공하지 않음"],
        ["3D", "유한 격자의 직교 투영. 임의 음함수나 임의 축 회전은 제공하지 않음"],
    ], [.25, .75]),
    h("다음 버전에 권하는 기능"),
    p("<b>1. 매개변수 조절바</b><br/>f(x)=a·sin(bx)+c에서 a, b, c를 움직이며 진폭·주기·이동과 넓이 변화를 바로 비교할 수 있습니다."),
    p("<b>2. 수업 발표 모드</b><br/>속성 패널을 접고 글자와 그래프를 크게 보여주면 강의실 화면에서 조작과 설명이 더 편해집니다."),
    p("<b>3. 극값·점근선과 도함수 겹쳐 보기</b><br/>함수의 증가·감소와 그래프 개형을 연결하는 대학 미적분 수업에 유용합니다."),
    plain("추가로 다각형 작도, 계산 과정을 담는 수업 노트 내보내기를 검토할 수 있습니다. 이 페이지의 개선안은 현재 구현된 기능과 구분한 제안입니다.", "small"),
], "18 / SCOPE & NEXT STEPS")


def decorate(c, doc):
    c.saveState()
    n = doc.page
    c.setStrokeColor(LINE)
    c.setLineWidth(.6)
    c.line(48, 50, A4[0]-48, 50)
    c.setFont("Korean", 8)
    c.setFillColor(MUTED)
    c.drawString(48, 35, "MathCanvas 0.3  |  수학 수업 사용 설명서")
    c.drawRightString(A4[0]-48, 35, f"{n:02d} / {len(titles):02d}")
    if n > 1:
        c.setFont("Korean", 8)
        c.drawString(48, A4[1]-30, "MATHCANVAS")
        c.drawRightString(A4[0]-48, A4[1]-30, titles[n-1] if n <= len(titles) else "")
    c.restoreState()


doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=48, rightMargin=48,
                        topMargin=55, bottomMargin=65, title="MathCanvas 0.3 한국어 사용 설명서",
                        author="MathCanvas", subject="빠른 안내와 전체 기능 사용법")
doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
reader = PdfReader(OUT)
assert len(reader.pages) == len(titles), f"Unexpected page spill: {len(reader.pages)} vs {len(titles)}"
text = "\n".join(page.extract_text() for page in reader.pages)
for phrase in ["빠른 안내", "선택 합계", "와셔법", "계산의 한계", "44/15", "Start-MathCanvas.command"]:
    assert phrase in text, f"Missing manual topic: {phrase}"
assert "\ufffd" not in text
(TMP / "manual-text.txt").write_text(text, encoding="utf8")
pdf = pymupdf.open(OUT)
thumbs = []
for i, pg in enumerate(pdf):
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(1.35, 1.35), alpha=False)
    image_path = TMP / f"page-{i+1:02d}.png"
    pix.save(str(image_path))
    img = PILImage.open(image_path).convert("RGB")
    img.thumbnail((300, 425))
    thumbs.append(img.copy())
for batch in range(math.ceil(len(thumbs)/6)):
    sheet = PILImage.new("RGB", (940, 920), "#dbe4ef")
    draw = ImageDraw.Draw(sheet)
    for j, img in enumerate(thumbs[batch*6:(batch+1)*6]):
        x, y = 10+(j%3)*310, 25+(j//3)*455
        sheet.paste(img, (x, y))
        draw.text((x+5, y-17), f"Page {batch*6+j+1}", fill="black")
    sheet.save(TMP / f"contact-{batch+1}.png")
print(f"Created {len(reader.pages)} pages: {OUT}")
print(f"Rendered all pages and contact sheets to {TMP}")
