"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LegalModalProps {
  onClose: () => void;
}

// ─── Shared modal shell ───
function LegalModalShell({ onClose, title, docId, fallback }: LegalModalProps & { title: string; docId: string; fallback: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "legal_docs", docId));
        if (snap.exists() && snap.data()?.content) {
          setHtml(snap.data().content as string);
        }
      } catch {
        // fallback to hardcoded
      } finally {
        setLoading(false);
      }
    })();
  }, [docId]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-4 z-50 bg-white rounded-2xl flex flex-col max-w-md mx-auto max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400 text-lg">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-600 leading-relaxed space-y-3" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
          ) : html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: fallback }} />
          )}
        </div>
      </div>
    </>
  );
}

// ─── Fallback content (current hardcoded) ───

const TERMS_FALLBACK = `
<p class="text-[10px] text-gray-400">制定日: 2026年3月24日 ｜ 最終更新日: 2026年3月24日</p>
<p class="font-bold text-sm text-gray-800">第1条（利用規約の同意）</p>
<p>Days Count in AUS（以下「本アプリ」）をご利用いただくことで、本利用規約に同意したものとみなします。同意いただけない場合は、本アプリのご利用をお控えください。</p>
<p class="font-bold text-sm text-gray-800">第2条（サービス概要）</p>
<p>本アプリは、Count.（運営者: 岳尾拓馬、以下「運営者」）が運営する、オーストラリアでのワーキングホリデー参加者が日々の体験・成長・コミュニティ活動を記録するための無料PWA（プログレッシブウェブアプリ）です。すべての機能を無償で提供しています。</p>
<p class="font-bold text-sm text-gray-800">第3条（アカウント登録）</p>
<p>・Googleアカウントによるログインが必要です。</p>
<p>・1人につき1アカウントとし、複数アカウントの作成は禁止します。</p>
<p>・アカウント上のすべての活動について、利用者ご自身が責任を負います。</p>
<p>・ニックネームは英数字（a-z, 0-9, _）で1〜15文字、かつ一意である必要があります。</p>
<p>・本アプリは18歳以上の方を対象としています。18歳未満の方はご利用いただけません。利用登録をもって、18歳以上であることを表明したものとみなします。</p>
<p class="font-bold text-sm text-gray-800">第4条（ユーザーコンテンツ）</p>
<p>・投稿したコンテンツ（テキスト・画像）の著作権は利用者に帰属します。</p>
<p>・公開投稿を行った場合、他の利用者がアプリ内で閲覧する非独占的・無償の権利を付与するものとします。</p>
<p>・公開投稿について、運営者は本アプリの宣伝・広告・プロモーション（SNS、ウェブサイト、広告素材等を含む）の目的で、無償かつ期間の制限なく利用できるものとします。利用にあたり、投稿者のニックネームやプロフィール画像が表示される場合があります。</p>
<p>・投稿は作成後5分以内に編集可能で、削除はいつでも可能です。ただし、削除前に運営者が取得したコンテンツの宣伝利用は継続される場合があります。</p>
<p>・非公開投稿はご本人のみ閲覧できます。非公開投稿は宣伝目的に使用されません。</p>
<p>・公開投稿の宣伝利用を希望しない場合は、お問い合わせ先までご連絡ください。該当コンテンツの宣伝利用を停止いたします。</p>
<p>・アップロードされた画像は自動的に圧縮され、EXIF情報（位置情報含む）は削除されます。</p>
<p class="font-bold text-sm text-gray-800">第5条（禁止行為）</p>
<p>利用者は以下の行為を行ってはなりません。</p>
<p>・攻撃的、侮辱的、名誉毀損的、または違法なコンテンツの投稿</p>
<p>・他の利用者への嫌がらせ、いじめ、脅迫</p>
<p>・他の利用者へのなりすまし、偽アカウントの作成</p>
<p>・XP・ストリーク・レベルの不正操作（自動化、バグの悪用等）</p>
<p>・通常の利用範囲を超えたデータベース・APIへのアクセスや改変</p>
<p>・商業広告、スパム、勧誘目的での利用</p>
<p>・本アプリからのデータの体系的な収集・スクレイピング</p>
<p class="font-bold text-sm text-gray-800">第6条（コンテンツモデレーション）</p>
<p>・投稿は禁止コンテンツの自動スクリーニングを受けます。違反投稿は事前通知なく非表示にされる場合があります。</p>
<p>・利用者は投稿や他の利用者を通報できます。3件以上の通報を受けた投稿は自動的に非表示となります。</p>
<p>・非表示から30日以上経過した投稿は永久に削除される場合があります。</p>
<p class="font-bold text-sm text-gray-800">第7条（コミュニティ）</p>
<p>・Lv.13以上の利用者はコミュニティに参加でき、Lv.20以上で作成できます。</p>
<p>・各利用者は最大2つのコミュニティに参加できます（公式コミュニティを除く）。</p>
<p>・1コミュニティの上限は10名です。</p>
<p>・リーダーがコミュニティの管理責任を負います。リーダーが退会した場合、コミュニティは解散されます。</p>
<p>・メッセージは100文字以内です。</p>
<p>・グループチャット内での利用者間のトラブル（誹謗中傷、詐欺、個人情報の漏洩等）について、運営者は一切の責任を負いません。利用者間で解決するものとします。</p>
<p>・運営者は、通報等により悪質と判断したメッセージやユーザーに対して、削除・アカウント停止等の措置を講じることがあります。</p>
<p class="font-bold text-sm text-gray-800">第8条（XP・レベル・ストリーク）</p>
<p>・XPは投稿やいいねの受信により獲得できます。XP・レベルに金銭的価値はありません。</p>
<p>・ストリークは48時間投稿がない場合にリセットされます。期限の6時間前に警告通知が送信されます（通知を有効にしている場合）。</p>
<p>・いいねの送信回数に制限はありませんが、いいね送信によるXP獲得は1日5回までです。</p>
<p class="font-bold text-sm text-gray-800">第9条（広告の表示）</p>
<p>・本アプリ内にスポンサーおよび第三者による広告が表示される場合があります。</p>
<p>・広告の内容は運営者が管理しますが、広告主の商品・サービスについて運営者は一切の保証をいたしません。</p>
<p>・広告のリンク先は外部サイトであり、当該サイトの利用規約およびプライバシーポリシーは各サイトのものが適用されます。</p>
<p class="font-bold text-sm text-gray-800">第10条（外部リンク・外部サービス）</p>
<p>・本アプリ内にはZoom、その他の外部サービスへのリンクが含まれる場合があります。</p>
<p>・外部サービスの利用は各サービスの利用規約に従うものとし、運営者は外部サービスの内容、安全性、可用性について一切の責任を負いません。</p>
<p>・外部リンクを通じて発生したトラブル（個人情報の漏洩、詐欺、損害等）について、運営者は責任を負いません。</p>
<p>・外部サービス上での利用者間のやり取り（Zoom通話を含む）において発生したトラブルについて、運営者は一切関与せず、責任を負いません。</p>
<p class="font-bold text-sm text-gray-800">第11条（プッシュ通知）</p>
<p>・プッシュ通知は任意です。ブラウザの設定からいつでも有効・無効を切り替えられます。</p>
<p>・通知はストリーク警告、いいね通知、その他アプリ関連のお知らせに使用されます。</p>
<p class="font-bold text-sm text-gray-800">第12条（ブロック・通報）</p>
<p>・任意の利用者をブロックできます。ブロックした利用者の投稿はフィードに表示されません。</p>
<p>・通報には理由とスクリーンショットが必要です。虚偽の通報はアカウント停止の対象となります。</p>
<p class="font-bold text-sm text-gray-800">第13条（アカウントの停止・削除）</p>
<p>・運営者は、本規約に違反するアカウントを事前通知なく停止または削除する権利を有します。</p>
<p>・利用者は設定画面からいつでもアカウントを削除できます。削除は永久的であり、取り消しはできません。</p>
<p class="font-bold text-sm text-gray-800">第14条（サービスの終了）</p>
<p>・運営者は、事前の予告なく本アプリのサービスを一時停止または終了できるものとします。</p>
<p>・サービス終了後、利用者のデータ（投稿、プロフィール、画像等）は削除され、復元はできません。</p>
<p>・サービスの終了に伴い利用者に生じた損害について、運営者の故意または重過失による場合を除き、運営者は責任を負いません。</p>
<p class="font-bold text-sm text-gray-800">第15条（免責事項）</p>
<p>本アプリは「現状のまま」提供され、明示・黙示を問わずいかなる保証もいたしません。中断のない運用、エラーのない動作、セキュリティの完全性を保証するものではありません。システム障害によるデータ損失について、運営者の故意または重過失による場合を除き、責任を負いません。</p>
<p class="font-bold text-sm text-gray-800">第16条（責任の制限）</p>
<p>運営者の故意または重過失による場合を除き、運営者は本アプリの利用または利用不能から生じる間接的、偶発的、特別、結果的損害について責任を負いません。</p>
<p class="font-bold text-sm text-gray-800">第17条（不可抗力）</p>
<p>天災、戦争、テロ、暴動、法令の制定・改廃、通信回線の障害、その他運営者の責めに帰さない事由により本アプリの提供が困難となった場合、運営者は責任を負いません。</p>
<p class="font-bold text-sm text-gray-800">第18条（知的財産権）</p>
<p>本アプリのUI、デザイン、ロゴ、ソースコード、その他の構成要素に関する知的財産権は運営者に帰属します。利用者は、運営者の事前の書面による承諾なく、これらを複製、改変、再配布することはできません。</p>
<p class="font-bold text-sm text-gray-800">第19条（準拠法・管轄裁判所）</p>
<p>本規約は日本法に準拠し、日本法に従って解釈されます。本規約に関する紛争については、福岡地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
<p class="font-bold text-sm text-gray-800">第20条（規約の変更）</p>
<p>運営者は本規約を随時変更できるものとします。重要な変更はアプリ内で通知します。変更後の利用継続をもって、変更に同意したものとみなします。</p>
<p class="font-bold text-sm text-gray-800">第21条（お問い合わせ）</p>
<p>ご不明な点がございましたら、以下までご連絡ください。</p>
<p>メール: <b>communirybrisbane@gmail.com</b></p>
<p>Instagram: <b>@count_taku</b></p>
`;

const PRIVACY_FALLBACK = `
<p class="text-[10px] text-gray-400">制定日: 2026年3月24日 ｜ 最終更新日: 2026年3月24日</p>
<p class="font-bold text-sm text-gray-800">第1条（運営者）</p>
<p>Days Count in AUS（以下「本アプリ」）は、Count.（運営者: 岳尾拓馬、以下「運営者」）が運営しています。</p>
<p class="font-bold text-sm text-gray-800">第2条（収集する情報）</p>
<p>本アプリでは以下の情報を収集します。</p>
<p><b>a) アカウント情報（Googleログインより取得）:</b></p>
<p>・GoogleアカウントUID（一意の識別子）</p>
<p>・表示名・プロフィール画像（初期値として使用、変更可能）</p>
<p>※メールアドレスやGoogleパスワードは保存しません。</p>
<p><b>b) 利用者が入力するプロフィール情報:</b></p>
<p>・ニックネーム、地域、目標、フォーカスモード、出発日/到着日、プロフィール画像</p>
<p><b>c) ユーザー生成コンテンツ:</b></p>
<p>・投稿（テキスト最大400文字、画像は圧縮後最大300KB）</p>
<p>・グループメッセージ（最大100文字）、メッセージリアクション</p>
<p>・いいね、フォロー、ブロック、通報</p>
<p><b>d) 自動収集データ:</b></p>
<p>・XP、レベル、ストリーク数、活動タイムスタンプ</p>
<p>・プッシュ通知トークン（通知を有効にしている場合）</p>
<p>・Firebase Analyticsによる基本的な利用統計（ページビュー、セッション時間、デバイス情報）</p>
<p class="font-bold text-sm text-gray-800">第3条（情報の利用目的）</p>
<p>・本アプリの機能提供・運営（投稿、グループ、探索、ストリーク、レベリング）</p>
<p>・他の利用者への公開プロフィール表示（ニックネーム、写真、レベル、地域、フォーカスモード）</p>
<p>・XP、レベル、ストリークの計算</p>
<p>・プッシュ通知の送信（ストリーク警告、いいね通知。有効時のみ）</p>
<p>・コンテンツのモデレーションおよびコミュニティガイドラインの遵守</p>
<p>・集計された利用統計に基づくアプリの改善</p>
<p>・公開投稿の本アプリの宣伝・広告・プロモーションへの利用</p>
<p class="font-bold text-sm text-gray-800">第4条（画像処理）</p>
<p>アップロードされるすべての画像は、送信前にクライアント側で処理されます。</p>
<p>・適切なサイズにリサイズ（投稿: 最大1024px、アバター: 512px、グループアイコン: 256px）</p>
<p>・JPEG形式に圧縮</p>
<p>・<b>EXIF情報（GPS位置情報、カメラ情報、タイムスタンプ含む）は自動的に削除</b>されます。これにより位置情報のプライバシーが保護されます。</p>
<p class="font-bold text-sm text-gray-800">第5条（データの保存とセキュリティ）</p>
<p>・すべてのデータはGoogle Cloud Platform上のFirebase（FirestoreおよびCloud Storage）に保存されます。</p>
<p>・Firebaseセキュリティルールによりユーザー権限に応じたアクセス制御を実施しています。</p>
<p>・機密データ（プッシュ通知トークン、ブロックリスト）はアカウント所有者のみアクセス可能な非公開サブコレクションに保存されます。</p>
<p>・本アプリはVercelでホスティングされています。</p>
<p>・データはアカウントが有効な間保持されます。</p>
<p>・データはGoogle Cloud Platform（米国等の海外サーバーを含む）に保存される場合があります。Googleのセキュリティ基準およびデータ保護方針に基づき管理されます。</p>
<p class="font-bold text-sm text-gray-800">第6条（データの共有）</p>
<p>運営者は利用者の個人情報を第三者に販売、交換、共有<b>しません</b>。ただし以下の場合を除きます。</p>
<p>・公開投稿およびプロフィール情報（ニックネーム、写真、レベル、地域）は他の利用者に表示されます。</p>
<p>・非公開投稿はアカウント所有者のみ閲覧できます。</p>
<p>・Firebase Analyticsのデータは集計された形でGoogleにより処理されます（個人を特定できません）。</p>
<p>・法令に基づく開示要請があった場合</p>
<p class="font-bold text-sm text-gray-800">第7条（第三者サービス）</p>
<p>本アプリは以下の第三者サービスを利用しています。</p>
<p>・<b>Google Firebase:</b> 認証、データベース、ファイルストレージ、プッシュ通知、アナリティクス、Cloud Functions</p>
<p>・<b>Vercel:</b> アプリのホスティングおよびデプロイ</p>
<p>・<b>スポンサー広告:</b> アプリ内にスポンサーによる広告が表示される場合があります。広告主に利用者の個人情報を提供することはありません。</p>
<p>広告ネットワーク、トラッキングピクセル、その他の第三者アナリティクスは使用していません。</p>
<p class="font-bold text-sm text-gray-800">第8条（利用者の権利）</p>
<p>・<b>アクセス:</b> アプリ内でご自身のすべてのデータ（プロフィール、投稿、グループ）を確認できます。</p>
<p>・<b>訂正:</b> プロフィールや投稿はいつでも編集できます。</p>
<p>・<b>削除:</b> 設定画面からアカウントを削除できます。削除するとすべてのデータ（プロフィール、投稿、グループ、画像）が永久に削除されます。取り消しはできません。</p>
<p>・<b>通知の停止:</b> ブラウザの設定からいつでもプッシュ通知を無効にできます。</p>
<p>・<b>広告利用の停止:</b> 公開投稿の宣伝利用を希望しない場合は、お問い合わせ先までご連絡ください。</p>
<p>・<b>同意の撤回:</b> 個人情報の取扱いに関する同意を撤回する場合は、設定画面からアカウントを削除してください。アカウント削除によりすべてのデータが永久に削除され、同意は撤回されたものとみなします。</p>
<p class="font-bold text-sm text-gray-800">第9条（年齢制限）</p>
<p>本アプリは18歳未満の方を対象としていません。18歳未満の方から情報を収集していることが判明した場合、速やかに当該アカウントを削除します。</p>
<p class="font-bold text-sm text-gray-800">第10条（データ侵害）</p>
<p>利用者の個人情報に影響を及ぼす可能性のあるデータ侵害が発生した場合、合理的に可能な限り速やかにアプリ内で影響を受ける利用者に通知します。</p>
<p class="font-bold text-sm text-gray-800">第11条（ポリシーの変更）</p>
<p>運営者は本プライバシーポリシーを随時更新できるものとします。重要な変更はアプリ内で通知します。変更後の利用継続をもって、変更に同意したものとみなします。</p>
<p class="font-bold text-sm text-gray-800">第12条（お問い合わせ）</p>
<p>プライバシーに関するお問い合わせは以下までご連絡ください。</p>
<p>メール: <b>communirybrisbane@gmail.com</b></p>
<p>Instagram: <b>@count_taku</b></p>
`;

const LEGAL_NOTICE_FALLBACK = `
<p class="text-[10px] text-gray-400">制定日: 2026年3月24日 ｜ 最終更新日: 2026年3月24日</p>
<p class="font-bold text-sm text-gray-800">特定商取引法に基づく表記</p>
<table class="w-full border-collapse mt-2">
  <tbody>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">サービス名</td><td class="py-2 text-gray-600">Days Count in AUS</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">運営者</td><td class="py-2 text-gray-600">Count.（岳尾拓馬 / 個人運営）</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">所在地</td><td class="py-2 text-gray-600">請求があった場合に遅滞なく開示いたします</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">連絡先</td><td class="py-2 text-gray-600">メール: communirybrisbane@gmail.com<br/>Instagram: @count_taku</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">販売価格</td><td class="py-2 text-gray-600">無料（全機能を無償で提供）</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">サービス以外の必要料金</td><td class="py-2 text-gray-600">インターネット接続料金はお客様のご負担となります</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">支払方法</td><td class="py-2 text-gray-600">該当なし（無料サービス）</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">提供時期</td><td class="py-2 text-gray-600">アカウント作成後、Webブラウザより即時ご利用いただけます</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">解約・返金</td><td class="py-2 text-gray-600">設定画面よりいつでもアカウントを削除できます。無料サービスのため返金はございません。</td></tr>
    <tr class="border-b border-gray-100"><td class="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap align-top">動作環境</td><td class="py-2 text-gray-600">JavaScript対応のモダンブラウザ（Chrome, Safari, Edge, Firefox）。PWAインストール対応。</td></tr>
  </tbody>
</table>
`;

// ─── Exported modals ───

export function TermsModal({ onClose }: LegalModalProps) {
  return <LegalModalShell onClose={onClose} title="利用規約" docId="terms" fallback={TERMS_FALLBACK} />;
}

export function PrivacyModal({ onClose }: LegalModalProps) {
  return <LegalModalShell onClose={onClose} title="プライバシーポリシー" docId="privacy" fallback={PRIVACY_FALLBACK} />;
}

export function LegalNoticeModal({ onClose }: LegalModalProps) {
  return <LegalModalShell onClose={onClose} title="特定商取引法に基づく表記" docId="legal_notice" fallback={LEGAL_NOTICE_FALLBACK} />;
}
