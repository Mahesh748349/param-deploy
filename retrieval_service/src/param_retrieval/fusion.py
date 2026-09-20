"""Backend-independent equal-weight reciprocal-rank fusion."""


def reciprocal_rank_fusion(branches, k=60):
    merged = {}
    for name, hits in branches.items():
        seen = set()
        for rank, hit in enumerate(hits, 1):
            if hit['id'] in seen:
                continue
            seen.add(hit['id'])
            result = merged.setdefault(hit['id'], {
                **hit, 'score': 0.0, 'score_type': 'rrf', 'ranks': {}, 'branch_scores': {},
            })
            result['score'] += 1.0 / (k + rank)
            result['ranks'][name] = rank
            result['branch_scores'][name] = hit['score']
    return sorted(merged.values(), key=lambda p: (-p['score'], p['id']))
