"""Select a relevance cutoff on labeled pairs; verify it on held-out queries.

Input JSONL: {"query": "...", "text": "...", "relevant": true}
These labels must be human-reviewed; do not label using the model's own scores.
"""
import argparse
import json
from pathlib import Path
from dotenv import load_dotenv
from param_retrieval import Settings
from param_retrieval.reranking import Reranker


def metrics(rows, threshold):
    tp = sum(label and score >= threshold for score, label in rows)
    selected = sum(score >= threshold for score, label in rows)
    positives = sum(label for score, label in rows)
    return {'precision': tp / selected if selected else 0.0,
            'recall': tp / positives if positives else 0.0, 'selected': selected, 'pairs': len(rows)}


def load_pairs(path):
    values = [json.loads(line) for line in Path(path).read_text(encoding='utf-8').splitlines() if line.strip()]
    for value in values:
        if type(value.get('relevant')) is not bool or not value.get('query') or not value.get('text'):
            raise ValueError('Each pair needs query, text and a boolean human relevance label')
    if sum(v['relevant'] for v in values) < 10 or sum(not v['relevant'] for v in values) < 10:
        raise ValueError('Provide at least 10 positive and 10 negative labeled pairs per split')
    return values


def main():
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument('training_pairs')
    parser.add_argument('validation_pairs')
    parser.add_argument('--precision', type=float, default=0.9)
    args = parser.parse_args()
    if not 0 < args.precision <= 1:
        parser.error('--precision must be in (0,1]')
    training, validation = load_pairs(args.training_pairs), load_pairs(args.validation_pairs)
    if {r['query'].strip().casefold() for r in training} & {r['query'].strip().casefold() for r in validation}:
        raise ValueError('Use different queries for calibration and held-out validation')
    reranker = Reranker(Settings())
    def score(pairs):
        return [(reranker.scores(p['query'], [{'text': p['text']}])[0], p['relevant']) for p in pairs]
    train_scores, valid_scores = score(training), score(validation)
    eligible = [(metrics(train_scores, threshold)['recall'], threshold)
                for threshold in {s for s, _ in train_scores}
                if metrics(train_scores, threshold)['precision'] >= args.precision]
    if not eligible:
        raise SystemExit('No cutoff met the calibration precision target. Do not enable pruning.')
    _, threshold = max(eligible, key=lambda item: (item[0], -item[1]))
    report = metrics(valid_scores, threshold)
    print('Model:', reranker.settings.rerank_model)
    print('Calibration:', metrics(train_scores, threshold))
    print('Held-out validation:', report)
    if report['precision'] < args.precision or not report['selected']:
        raise SystemExit('Held-out precision target failed. Review labels/model before enabling pruning.')
    print('Candidate setting (review recall and sample size before deploying):')
    print(f'PARAM_RERANK_MIN_SCORE={threshold}')


if __name__ == '__main__':
    main()
