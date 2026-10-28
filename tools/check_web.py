from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> None:
    output = Path(r"D:\table\ros_car\xuanxun-starshield\evidence\web-console-live.png")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        errors: list[str] = []
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto("http://127.0.0.1:5173", wait_until="networkidle")
        page.screenshot(path=str(output), full_page=True)
        body = page.locator("body").inner_text()
        assert "玄巡·星盾" in body
        assert "边缘服务在线" in body
        assert "当前等级" in body
        assert "NORMAL" in body
        assert not errors, errors
        print("WEB_SMOKE_PASS")
        print(f"title={page.title()}")
        print(f"screenshot={output}")
        browser.close()


if __name__ == "__main__":
    main()
