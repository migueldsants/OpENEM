---
titulo: Privacy Policy
descricao: What data OpENEM keeps, what for, for how long, who it is shared with and how you exercise your rights.
atualizado: 2026-11-13
---

## Summary

- OpENEM keeps the minimum you need to study: your email, your password (only its hash), the name you choose and what you do in the app.
- There are no ads, no data is sold and no profile of you is built for advertising.
- Other students never see your email.
- In **Perfil** (Profile), you can download all your data or delete your account whenever you want.

## Who is responsible for your data

OpENEM is free software under the AGPL-3.0 license: any school, prep course or person can run their own copy. Decisions about your data are made by whoever runs the copy you are using, the **controller** (LGPD, art. 5, VI). The LGPD is Brazil's General Data Protection Law (Law 13,709/2018).

- Controller: [PLACEHOLDER: name or company name, CPF or CNPJ and address]
- Data protection officer (encarregado): [PLACEHOLDER: name of the data protection officer]
- Contact of the data protection officer: [PLACEHOLDER: contact email]

## What data we collect and why

For each piece of data below you will find its purpose, its legal basis under the LGPD, how long it is kept and who it is shared with. We rely on two legal bases: **performance of a contract** (art. 7, V), to provide the service you asked for when you created the account, and **legitimate interest** (art. 7, IX), to keep the service secure.

### Email

- **Purpose:** identifying your account and signing you in.
- **Legal basis:** performance of a contract.
- **Retention:** while the account exists.
- **Shared with:** no one. Other students do not see your email.

### Password

- **Purpose:** confirming it is you when you sign in and when you delete the account.
- **How we store it:** only the password hash (argon2), from which the password cannot be recovered. Not even whoever runs the server can see your password.
- **Legal basis:** performance of a contract.
- **Retention:** while the account exists.
- **Shared with:** no one.

### Display name and study profile

The name in the **Como quer ser chamado** (what to call you) field, which is optional, your goal (SISU, ProUni or Treineiro), your study minutes per day, your foreign language and your preferences, such as the distraction-free mode and gamification.

- **Purpose:** showing your name in the forum and the leaderboard and adjusting goals and recommendations.
- **Legal basis:** performance of a contract.
- **Retention:** while the account exists.
- **Shared with:** your name, goal, level, league, XP, day streak and achievements appear on your public profile and on the leaderboard, to other signed-in students. Without a chosen name, **Estudante** (Student) is shown. If you turn gamification off in **Perfil**, you leave the leaderboard.

### Study activity

Answers (chosen option, whether it was right and time spent), mock exams and scores, reviews, favorites, notes, flashcards and decks you created, votes on decks, formulas, study schedule, weekly goals, Pomodoro sessions, saved videos and their notes, submitted essays, XP, achievements, day streak and daily challenges.

- **Purpose:** this is the service itself: saving your progress, building spaced review, recommending questions and showing your performance.
- **Legal basis:** performance of a contract.
- **Retention:** while the account exists.
- **Shared with:** no one. A deck you make public is visible to other students.

### Forum and color themes

Threads, replies, likes, reports you made, and color themes you created, published and liked.

- **Purpose:** the Q&A forum and the community theme gallery.
- **Legal basis:** performance of a contract. Reports are kept on the basis of legitimate interest, to moderate the community.
- **Retention:** while the account exists, or until you delete the thread or reply. A report is removed together with the reported content.
- **Shared with:** published threads, replies and themes appear to other signed-in students, with your display name. The person you reported does not learn it was you. Reports are read by whoever moderates this installation.

### Acceptance of the terms

The date and the version of these documents you accepted when you created the account.

- **Purpose:** recording your acceptance of the Terms of Use and of this policy.
- **Legal basis:** performance of a contract.
- **Retention:** while the account exists.
- **Shared with:** no one.

### Requests for AI comments

When you ask for the comment on a question, we record the request (its time and type) to count the daily limit.

- **Purpose:** limiting the use of a service that is paid for by whoever runs the server.
- **Legal basis:** legitimate interest.
- **Retention:** while the account exists.
- **Shared with:** the AI provider receives **only the text of the question** (statement, options and answer key), never your email, your name or any other data about you. The generated comment is saved on the question and serves every student.

### IP address and access data

On every request, the web server (nginx) records the IP address, the date and time, the requested address and the browser. The rate limiter counts requests per IP (or per account, when you are signed in) in Redis, and counts wrong passwords per account.

- **Purpose:** security, to protect the service against abuse, bots and attempts to break into accounts.
- **Legal basis:** legitimate interest.
- **Retention:** nginx logs, [PLACEHOLDER: retention period of the access logs]. The rate limit counters live in Redis memory and expire on their own, between 1 second and 10 minutes; a lockout after wrong passwords lasts from 15 minutes to 24 hours, and in that counter the email is stored as a hash.
- **Shared with:** no one, except by court order or a request from an authority as provided by law.

## Third-party services

- **AI provider** ([PLACEHOLDER: provider configured in this installation, or "none"]): receives only the text of the questions, as explained above.
- **Google Fonts:** the app loads its fonts from Google's servers, which receive your IP and browser data when you open the app. The site and the documentation use self-hosted fonts and do not do this.
- **YouTube:** in the video library, videos play in the youtube-nocookie.com player, which only sets cookies once you press play. When you press play and when thumbnails load, YouTube (Google) receives your IP and browser data. To fetch the title and thumbnail of a video you saved, the server sends YouTube only the video link.
- **GitHub:** the Ferramentas (Tools) screen shows repository stars, which the server fetches from GitHub without any data about you. The links open github.com, where GitHub's policy applies.
- **Onde estudar (Where to study):** the links open each institution's website in a new tab. OpENEM sends them no data about you, does not record clicks and opens the link without saying where you came from. What happens on the institution's website follows its own privacy policy.
- **Hosting:** [PLACEHOLDER: hosting company and country where the servers are].

Google, YouTube and GitHub are outside Brazil, usually in the United States. What your browser sends them (IP and browser data) is an international data transfer (LGPD, art. 33).

## On your device

Some things stay only in your browser and never reach the server: the session token, the theme in use, study boards, timers and the classroom board. The app also keeps on the device a copy of the screens you opened, for up to 7 days, and answers given offline until it can send them.

When you delete the account, the app removes from that device the token, that copy, the answers waiting to be sent and the boards. When you only sign out, just the token is removed: on a shared computer, prefer a private window.

OpENEM uses no tracking cookies and no audience analytics tools.

## Teenagers

OpENEM is made for high school students and university applicants, and many people here are 15 to 17 years old. That is why:

- Anyone under 18 uses OpENEM with the knowledge of a parent or guardian, and sign-up asks for that statement.
- Children under 12 should not create an account.
- Data is processed in the best interest of the teenager, as required by the LGPD (art. 14) and by the Digital Statute of Children and Adolescents (Law 15,211/2025).
- There are no ads, no data sales, no advertising profiles, no in-app purchases and no loot boxes.
- We collect only what is needed to study: we do not ask for full name, phone, school, address, photo or ID.
- By default, your name is shown as **Estudante** (Student). Do not use your full name as display name or post personal data in the forum.
- In the forum, you can delete what you wrote and report anything that is offensive, harassment or exposes personal data.
- A parent or guardian can ask, through the data protection officer's contact, for access to the teenager's data or for the account to be deleted. We ask for information to confirm the request is legitimate.

## Your rights

The LGPD (art. 18) gives you the right to:

1. Confirm whether we process data about you.
2. Access your data: in **Perfil**, **Baixar meus dados** (download my data) creates a file with everything linked to your account.
3. Correct incomplete, inaccurate or outdated data: your profile can be edited in **Perfil**.
4. Ask for anonymization, blocking or deletion of unnecessary or excessive data, or data processed in breach of the law.
5. Take your data to another service (portability): the **Baixar meus dados** file is JSON, an open format.
6. Ask for your data to be deleted: in **Perfil**, **Excluir conta** (delete account) deletes the account and everything linked to it, right away.
7. Know which public and private entities we share data with (see Third-party services).
8. Know that you may refuse consent and what happens if you do. Today no processing depends on your consent: without accepting the terms, you just cannot create an account.
9. Withdraw consent, when consent is the legal basis.

You can also object to processing based on legitimate interest and file a complaint with the Brazilian Data Protection Authority (ANPD), at gov.br/anpd.

For anything the app's buttons do not cover, write to the data protection officer: [PLACEHOLDER: contact email]. We reply within 15 days.

## Deleting your account

Deleting the account removes your profile, answers, mock exams, reviews, flashcards, schedule, goals, videos, themes, XP and achievements. Threads you created are removed with the other students' replies in them, and your replies in other people's threads are removed too. Likes and votes you gave are taken off the totals. It cannot be undone: if you want a copy, download your data first.

Backups: [PLACEHOLDER: whether there are database backups and for how long they keep data from deleted accounts].

## Security

Passwords are stored with argon2, there are attempt limits per IP and per account, and other students do not see your email. No system is fully secure: if an incident happens that may put you at risk or cause you harm, we will notify you and the ANPD (LGPD, art. 48).

## Changes to this policy

The date at the top shows the version in force, and sign-up records the version you accepted. Relevant changes will be announced before they take effect, [PLACEHOLDER: how the controller announces them, for example a notice in the app or an email].
