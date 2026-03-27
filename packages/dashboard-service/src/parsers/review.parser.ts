import type { FileParser } from './parser.interface.js';
import type { ReviewData, ReviewFinding } from '../events/event-types.js';
import { basename, dirname } from 'node:path';

export class ReviewParser implements FileParser<ReviewData> {
  public canParse(filePath: string): boolean {
    return /TASK_\d{4}_\d{3}\/review-.+\.md$/.test(filePath);
  }

  public parse(content: string, filePath: string): ReviewData {
    const taskId = this.extractTaskId(filePath);
    if (!taskId || !taskId.startsWith('TASK_')) {
      console.warn(`[review-parser] skipping review in non-task folder: ${filePath}`);
      return {
        taskId: '',
        reviewType: '',
        overallScore: '',
        assessment: '',
        criticalIssues: 0,
        seriousIssues: 0,
        moderateIssues: 0,
        findings: [],
      };
    }
    const reviewType = this.extractReviewType(filePath);
    const lines = content.split('\n');

    const summary = this.extractSummary(lines);
    const findings = this.extractFindings(lines);

    return {
      taskId,
      reviewType,
      overallScore: summary.overallScore,
      assessment: summary.assessment,
      criticalIssues: summary.criticalIssues,
      seriousIssues: summary.seriousIssues,
      moderateIssues: summary.moderateIssues,
      findings,
    };
  }

  private extractTaskId(filePath: string): string {
    const dir = basename(dirname(filePath));
    return dir.startsWith('TASK_') ? dir : '';
  }

  private extractReviewType(filePath: string): string {
    const name = basename(filePath, '.md');
    return name.replace('review-', '');
  }

  private extractSummary(lines: ReadonlyArray<string>): {
    overallScore: string;
    assessment: string;
    criticalIssues: number;
    seriousIssues: number;
    moderateIssues: number;
  } {
    let overallScore = '';
    let assessment = '';
    let criticalIssues = 0;
    let seriousIssues = 0;
    let moderateIssues = 0;

    for (const line of lines) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length < 2) continue;

      switch (cells[0]) {
        case 'Overall Score':
          overallScore = cells[1];
          break;
        case 'Assessment':
          assessment = cells[1];
          break;
        case 'Critical Issues':
          criticalIssues = parseInt(cells[1], 10) || 0;
          break;
        case 'Serious Issues':
          seriousIssues = parseInt(cells[1], 10) || 0;
          break;
        case 'Moderate Issues':
          moderateIssues = parseInt(cells[1], 10) || 0;
          break;
      }
    }

    return { overallScore, assessment, criticalIssues, seriousIssues, moderateIssues };
  }

  private extractFindings(lines: ReadonlyArray<string>): ReadonlyArray<ReviewFinding> {
    const findings: ReviewFinding[] = [];
    let currentQuestion = '';
    let currentContent: string[] = [];
    let inFinding = false;

    for (const line of lines) {
      const h3Match = line.match(/^### \d+\.\s*(.+)$/);
      if (h3Match) {
        if (inFinding && currentQuestion) {
          findings.push({ question: currentQuestion, content: currentContent.join('\n').trim() });
        }
        currentQuestion = h3Match[1].trim();
        currentContent = [];
        inFinding = true;
        continue;
      }

      if (line.startsWith('## ') && inFinding) {
        if (currentQuestion) {
          findings.push({ question: currentQuestion, content: currentContent.join('\n').trim() });
        }
        inFinding = false;
        currentQuestion = '';
        currentContent = [];
        continue;
      }

      if (inFinding) {
        currentContent.push(line);
      }
    }

    if (inFinding && currentQuestion) {
      findings.push({ question: currentQuestion, content: currentContent.join('\n').trim() });
    }

    return findings;
  }
}
