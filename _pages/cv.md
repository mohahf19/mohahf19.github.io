---
layout: archive
title: "CV"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Education
======
* B.S. in Computer Engineering, Bilkent University, 2021 
* B.S. in Mathematics, Bilkent University, 2021

Work experience
======

* Summer 2019: iOS Developer
  * FDNSoft
  * Worked on creating an application that applies filters to images
  
Skills
======
* Software:
  * C++, Swift, Java, Python, Latex, Github, UML, Matlab, PHP
* Databases:
  * MySQL, Firebase


Write-ups
======
  <ul>{% for post in site.publications %}
    {% include archive-single-cv.html %}
  {% endfor %}</ul>
  
Talks
======
  <ul>{% for post in site.talks %}
    {% include archive-single-talk-cv.html %}
  {% endfor %}</ul>
