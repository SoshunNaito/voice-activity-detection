// クロスブラウザ定義
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// 変数定義
let localMediaStream = null;
let localScriptProcessor = null;
let audioContext = null;
let bufferSize = 1024;
let recordingFlg = false;

// キャンバス
let canvas1 = document.getElementById('canvas1');
let canvas2 = document.getElementById('canvas2');
let canvas3 = document.getElementById('canvas3');
let canvasContext1 = canvas1.getContext('2d');
let canvasContext2 = canvas2.getContext('2d');
let canvasContext3 = canvas3.getContext('2d');

// 音声解析
let audioAnalyser = null;
let timeDomainData = null;
let frequencyData = null;

let fsDivN = 0;// 1サンプルあたりの周波数
const scoreDataSize = 100;// 保持する配列サイズ
const attenuation_param = 0.999;// 減衰率

let scores = new Array(scoreDataSize).fill(0);// スコアの履歴
const scoreMax = 10000;
let sampleData = [];// スコアの統計データ(値)
let sampleCount = [];// スコアの統計データ(重み)
let thresholds = new Array(scoreDataSize).fill(0);// 大津の閾値(計算結果)

// 録音バッファ作成（録音中自動で繰り返し呼び出される）
let onAudioProcess = function (e) {
	if (!recordingFlg) return;

	// 録音データを更新する
	audioAnalyser.getByteTimeDomainData(timeDomainData);
	audioAnalyser.getByteFrequencyData(frequencyData);

	// 波形を解析
	analyseVoice();
	draw();
};

// 解析
let analyseVoice = function () {
	let score = 0;
	let width = 2000, offset = 4000;// [0, 2000]のデータ - [4000, 6000]のデータをスコアとする
	for (let i = 0; i < frequencyData.length; i++) {
		let f = i * fsDivN;
		if (f <= width) {
			score += frequencyData[i];
		}
		else if (f >= offset && f <= offset + width) {
			score -= frequencyData[i];
		}
	}
	if (score <= 0) { score = 0; }
	console.log(score);

	scores.push(score);
	scores.shift();

	for (let i = 0; i < sampleCount.length; i++) {
		sampleCount[i] *= attenuation_param;
		if (sampleCount[i] < 0.001) {
			sampleCount[i] = 0.001;
		}
	}

	if ((scores[scoreDataSize - 2] - scores[scoreDataSize - 1]) * (scores[scoreDataSize - 2] - scores[scoreDataSize - 3]) > 0) {
		// 統計データの更新
		if (sampleData.length == 0 || (sampleData.length > 0 && sampleData[sampleData.length - 1] < score)) {
			sampleData.push(score);
			sampleCount.push(1);
		}
		else {
			for (let i = 0; i < sampleData.length; i++) {
				if (sampleData[i] >= score) {
					sampleData.splice(i, 0, score);
					sampleCount.splice(i, 0, 1);
					break;
				}
			}
		}
		if (sampleData.length > scoreDataSize) {
			let k = 0, x = sampleData[1] - sampleData[0];
			for (let i = 0; i < sampleData.length - 1; i++) {
				if (sampleData[i + 1] - sampleData[i] > x) {
					x = sampleData[i + 1] - sampleData[i];
					k = i;
				}
			}
			let y = sampleCount[k] + sampleCount[k + 1];
			x = sampleData[k] * sampleCount[k] + sampleData[k + 1] * sampleCount[k + 1];
			x /= y;

			sampleData.splice(k, 2, x);
			sampleCount.splice(k, 2, y);
		}
	}

	// 大津の閾値
	let dataSum = 0, countSum = 0;
	for (let i = 0; i < sampleData.length; i++) {
		dataSum += sampleData[i] * sampleCount[i];
		countSum += sampleCount[i];
	}
	let k = -1, x = -1;
	let tempData = 0, tempCount = 0;
	for (let i = 0; i < sampleData.length - 1; i++) {
		tempData += sampleData[i] * sampleCount[i];
		tempCount += sampleCount[i];
		let r1 = (i + 1) / sampleData.length;
		let r2 = (1 - r1);
		let m1 = tempData / tempCount;
		let m2 = (dataSum - tempData) / (countSum - tempCount);
		let s = r1 * r2 * (m1 - m2) * (m1 - m2);
		if (x < s) {
			k = i;
			x = s;
		}
	}
	if (k == -1) {
		x = 0;
	}
	else {
		x = (sampleData[k] + sampleData[k + 1]) / 2;
	}
	thresholds.push(x);
	thresholds.shift();
}

// 描画
let draw = function () {
	canvasContext1.clearRect(0, 0, canvas1.width, canvas1.height);
	canvasContext2.clearRect(0, 0, canvas2.width, canvas2.height);
	canvasContext3.clearRect(0, 0, canvas3.width, canvas3.height);

	canvasContext1.beginPath();
	canvasContext2.beginPath();
	canvasContext3.beginPath();

	canvasContext1.moveTo(0, 0); canvasContext1.lineTo(canvas1.width, 0); canvasContext1.lineTo(canvas1.width, canvas1.height); canvasContext1.lineTo(0, canvas1.height); canvasContext1.lineTo(0, 0);
	canvasContext2.moveTo(0, 0); canvasContext2.lineTo(canvas2.width, 0); canvasContext2.lineTo(canvas2.width, canvas2.height); canvasContext2.lineTo(0, canvas2.height); canvasContext2.lineTo(0, 0);
	canvasContext3.moveTo(0, 0); canvasContext3.lineTo(canvas3.width, 0); canvasContext3.lineTo(canvas3.width, canvas3.height); canvasContext3.lineTo(0, canvas3.height); canvasContext3.lineTo(0, 0);

	for (let i = 0, len = timeDomainData.length; i < len; i++) {// 時間データの描画
		let x = (i / len) * canvas1.width;
		let y = (1 - (timeDomainData[i] / 255)) * canvas1.height;
		if (i == 0) {
			canvasContext1.moveTo(x, y);
		} else {
			canvasContext1.lineTo(x, y);
		}
	}
	for (let i = 0, len = frequencyData.length; i < len; i++) {// 周波数データの描画
		let x = (i / len) * canvas2.width;
		let y = (1 - (frequencyData[i] / 255)) * canvas2.height;
		if (i == 0) {
			canvasContext2.moveTo(x, y);
		} else {
			canvasContext2.lineTo(x, y);
		}
	}
	canvasContext3.strokeStyle = '#000';
	for (let i = 0, len = scores.length; i < len; i++) {// スコアの描画
		let x = (i / len) * canvas3.width;
		let y = (1 - (scores[i] / scoreMax)) * canvas3.height;
		if (y <= 0) { y = 0; }
		if (i == 0) {
			canvasContext3.moveTo(x, y);
		} else {
			canvasContext3.lineTo(x, y);
		}
	}

	for (let f = 0; ; f += 2000) {// 周波数の軸ラベル描画
		let text = (f < 1000) ? (f + ' Hz') : ((f / 1000) + ' kHz');
		let i = Math.floor(f / fsDivN);
		if (i >= frequencyData.length) { break; }
		let x = (i / frequencyData.length) * canvas2.width;

		canvasContext2.moveTo(x, 0);
		canvasContext2.lineTo(x, canvas2.height);
		canvasContext2.fillText(text, x, canvas2.height);
	}
	

	// x軸の線とラベル出力
	let textYs = ['1.00', '0.50', '0.00'];
	for (let i = 0, len = textYs.length; i < len; i++) {
		let text = textYs[i];
		let gy = (1 - parseFloat(text)) * canvas1.height;
		canvasContext1.moveTo(0, gy);
		canvasContext1.lineTo(canvas1.width, gy);
		canvasContext1.fillText(text, 0, gy);
	}
	textYs = ['8000', '6000', '4000', '2000', '0'];
	for (let i = 0, len = textYs.length; i < len; i++) {
		let text = textYs[i];
		let gy = (1 - parseFloat(text) / scoreMax) * canvas3.height;
		canvasContext3.moveTo(0, gy);
		canvasContext3.lineTo(canvas3.width, gy);
		canvasContext3.fillText(text, 0, gy);
	}

	canvasContext1.stroke();
	canvasContext2.stroke();
	canvasContext3.stroke();

	canvasContext3.beginPath();
	canvasContext3.strokeStyle = '#F80';
	for (let i = 0, len = thresholds.length; i < len; i++) {// 閾値の描画
		let x = (i / len) * canvas3.width;
		let y = (1 - (thresholds[i] / scoreMax)) * canvas3.height;
		if (y <= 0) { y = 0; }
		if (i == 0) {
			canvasContext3.moveTo(x, y);
		} else {
			canvasContext3.lineTo(x, y);
		}
	}
	canvasContext3.stroke();
}


// 解析開始
let startRecording = function () {
	recordingFlg = true;
	if (audioContext != null) { return; }
	navigator.getUserMedia({ audio: true }, function (stream) {
		audioContext = new AudioContext();

		// 録音関連
		localMediaStream = stream;
		let scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
		localScriptProcessor = scriptProcessor;
		let mediastreamsource = audioContext.createMediaStreamSource(stream);
		mediastreamsource.connect(scriptProcessor);
		scriptProcessor.onaudioprocess = onAudioProcess;
		scriptProcessor.connect(audioContext.destination);

		// 音声解析関連
		audioAnalyser = audioContext.createAnalyser();
		audioAnalyser.minDecibels = -110;
		audioAnalyser.fftSize = 2048;
		fsDivN = audioContext.sampleRate / audioAnalyser.fftSize;
		frequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
		timeDomainData = new Uint8Array(audioAnalyser.frequencyBinCount);
		mediastreamsource.connect(audioAnalyser);
	},
		function (e) {
			console.log(e);
		});
};

// 解析終了
let endRecording = function () {
	recordingFlg = false;

	//audioDataをサーバに送信するなど終了処理
};