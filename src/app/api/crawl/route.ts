import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(execFile);

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();

        // Validate URL
        if (!url) {
            return NextResponse.json(
                { error: '유효한 쿠팡 URL을 입력해주세요.' },
                { status: 400 }
            );
        }

        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            if (hostname !== 'coupang.com' && !hostname.endsWith('.coupang.com')) {
                return NextResponse.json(
                    { error: '유효한 쿠팡 URL을 입력해주세요.' },
                    { status: 400 }
                );
            }
        } catch {
            return NextResponse.json(
                { error: '유효하지 않은 URL 형식입니다.' },
                { status: 400 }
            );
        }

        // Remote crawler mode (for Vercel deployment)
        const crawlerUrl = process.env.CRAWLER_API_URL;
        if (crawlerUrl) {
            console.log('원격 크롤러 API 호출:', crawlerUrl);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

            try {
                const response = await fetch(`${crawlerUrl}/crawl`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                    signal: controller.signal,
                });

                const data = await response.json();

                if (!response.ok) {
                    return NextResponse.json(
                        { error: data.error || '원격 크롤링 실패' },
                        { status: response.status }
                    );
                }

                return NextResponse.json(data);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);

                if (errorMessage.includes('aborted')) {
                    return NextResponse.json(
                        { error: '원격 크롤러 타임아웃 (3분 초과)' },
                        { status: 504 }
                    );
                }

                return NextResponse.json(
                    { error: `원격 크롤러 API 오류: ${errorMessage}. 크롤러 서버가 실행 중인지 확인해주세요.` },
                    { status: 500 }
                );
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // Local mode: Path to the crawler script (coupang-review-nodriver.py)
        // Located in 대본/ directory, which is the parent of shorts-script-generator/
        const scriptName = 'coupang-review-nodriver.py';

        // Try multiple strategies to find the script
        const candidates = [
            // Strategy 1: Navigate from process.cwd() (works when cwd is shorts-script-generator)
            path.resolve(process.cwd(), '..', scriptName),
            // Strategy 2: Navigate from process.cwd() (works when cwd IS 대본)
            path.resolve(process.cwd(), scriptName),
            // Strategy 3: Hardcoded known path as final fallback
            path.resolve('C:\\Users\\campu\\OneDrive\\Desktop\\AI\\oh-my-claudecode\\workspace\\대본', scriptName),
        ];

        let scriptPath = '';
        let scriptDir = '';
        for (const candidate of candidates) {
            try {
                await fs.access(candidate);
                scriptPath = candidate;
                scriptDir = path.dirname(candidate);
                console.log('크롤러 스크립트 발견:', candidate);
                break;
            } catch {
                console.log('크롤러 스크립트 없음:', candidate);
            }
        }

        console.log('process.cwd():', process.cwd());

        // Check if script was found
        if (!scriptPath) {
            console.error('크롤러 스크립트를 찾을 수 없습니다. 시도한 경로:', candidates);
            return NextResponse.json(
                { error: '크롤러 스크립트를 찾을 수 없습니다.' },
                { status: 500 }
            );
        }

        // Run the crawler with the URL as environment variable
        const env = {
            ...process.env,
            COUPANG_URL: url,
            PYTHONIOENCODING: 'utf-8',
        };

        console.log('리뷰 크롤러 실행 중:', url);

        const { stdout, stderr } = await execAsync(
            'python',
            [scriptPath],
            {
                env,
                timeout: 180000, // 3 minutes timeout
                maxBuffer: 10 * 1024 * 1024, // 10MB
                cwd: scriptDir,
            }
        );

        console.log('리뷰 크롤러 stdout:', stdout.substring(0, 500));
        if (stderr) console.log('리뷰 크롤러 stderr:', stderr.substring(0, 500));

        // Find the output files
        // The crawler saves files as: coupang-product-info-{name}.txt and coupang-reviews-{name}.txt
        const files = await fs.readdir(scriptDir);

        // Find most recent product info and review files
        const productInfoFiles = files.filter(f => f.startsWith('coupang-product-info-') && f.endsWith('.txt'));
        const reviewFiles = files.filter(f => f.startsWith('coupang-reviews-') && f.endsWith('.txt') && !f.includes('nodriver'));

        if (reviewFiles.length === 0) {
            return NextResponse.json(
                { error: '리뷰 파일이 생성되지 않았습니다.' },
                { status: 500 }
            );
        }

        // Get the most recently modified files
        const getLatestFile = async (fileList: string[]) => {
            let latest = { name: '', mtime: 0 };
            for (const f of fileList) {
                const stat = await fs.stat(path.join(scriptDir, f));
                if (stat.mtimeMs > latest.mtime) {
                    latest = { name: f, mtime: stat.mtimeMs };
                }
            }
            return latest.name;
        };

        const latestReview = await getLatestFile(reviewFiles);
        const latestProductInfo = productInfoFiles.length > 0 ? await getLatestFile(productInfoFiles) : null;

        // Read file contents
        const reviews = await fs.readFile(path.join(scriptDir, latestReview), 'utf-8');
        const productInfo = latestProductInfo
            ? await fs.readFile(path.join(scriptDir, latestProductInfo), 'utf-8')
            : '';

        // Extract product name from file name (from review file)
        const productName = latestReview
            .replace('coupang-reviews-', '')
            .replace('.txt', '');

        return NextResponse.json({
            success: true,
            productName,
            productInfo,
            reviews,
            productInfoFile: latestProductInfo || '',
            reviewFile: latestReview,
        });

    } catch (error) {
        console.error('리뷰 크롤러 오류:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('timeout')) {
            return NextResponse.json(
                { error: '리뷰 크롤링 시간이 초과되었습니다. (3분 제한) Chrome이 실행 중이지 않은지 확인해주세요.' },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { error: `리뷰 크롤링 실패: ${errorMessage}` },
            { status: 500 }
        );
    }
}
