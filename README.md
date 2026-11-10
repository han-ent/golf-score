# FunGolf

FunGolf는 필드에서 쓰는 한국어 골프 스코어카드입니다. 계정도 서버도 없고, 점수와 메모는 이 기기에만 남습니다.

라이브 주소는 [https://ys-laube.github.io/goodgolfform/](https://ys-laube.github.io/goodgolfform/) 입니다. `main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포합니다.

## 하는 일

- 앱을 열면 지금 홀입니다. 라운드 이름, 코스, 인원은 설정의 작은 시트로 고칩니다.
- 파에 맞춘 `파` `보기` `더블`을 한 번 누르면 온·2펏이 기록되고 다음 선수, 그다음 홀로 넘어갑니다.
- 온만 누르면 표준 2펏으로 기록됩니다. 그 2펏은 흐리게 보이고, 직접 누른 1펏·3펏은 굵게 보입니다.
- 홀 메모는 접혀 있고, OB·해저드, 파온율, 파세이브, 1펏·3펏, 지난 라운드 평균과 파온 흐름을 볼 수 있습니다.
- 스코어카드 사진은 이 브라우저에서 만들고, 전반·후반을 나눠 담습니다.
- 한 번 온라인으로 열면 정적 파일을 기기에 캐시해서, 이후에는 코스에서 신호가 없어도 열립니다.

## 하지 않는 일

- 백엔드, 계정, 로그인, 클라우드 동기화, 랭킹, 소셜, 공개 링크
- 결제나 내기
- 외부 필드 데이터, 추천, 코칭

## 로컬 실행

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 배포와 저장소 이름

Pages 소스는 GitHub Actions입니다. 빌드의 base는 `./`라서 주소가 저장소 이름에 묶이지 않습니다.

저장소 이름을 `goodgolfform`에서 `fungolf`로 바꾸는 경우:

1. GitHub 저장소 Settings에서 이름을 `fungolf`로 바꿉니다. 이 저장소의 코드는 그 이름으로 다시 배포할 필요가 없습니다.
2. Actions에서 Deploy to GitHub Pages를 한 번 다시 실행합니다. 새 주소는 `https://ys-laube.github.io/fungolf/` 입니다.
3. 점수는 `localStorage`에 있고, 키는 출처(`https://ys-laube.github.io`) 기준이라 경로가 바뀌어도 같은 브라우저에 남습니다.
4. 새 주소를 신호가 있을 때 한 번 열어야 그 경로의 오프라인 캐시가 만들어집니다.

활성 라운드 키는 `fungolf-scorecard:active-round:v1`입니다. 예전 기록은 이 키로 그대로 읽습니다.
